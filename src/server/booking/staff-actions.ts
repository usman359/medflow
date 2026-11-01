"use server"

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { appointments, doctorServices, patients, services } from "@/db/schema"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { DATE_RE } from "@/lib/search-params/reception"
import { receptionBookingSchema } from "@/lib/validation/booking"
import { requireClinicAccess, requireRole } from "@/server/auth"
import { clinicDayRange, getScopedClinics } from "@/server/appointments/staff-queries"
import { loadSlotInput } from "@/server/availability/queries"
import { generateSlots, type Slot } from "@/server/availability/slots"
import { createBooking } from "./create-booking"

/** Reception, managers and admins can book on behalf of patients; doctors and patients cannot. */
const BOOKING_ROLES = ["receptionist", "manager", "admin"] as const

const slotsSchema = z.object({
  clinicId: z.uuid(),
  doctorId: z.uuid(),
  serviceId: z.uuid(),
  date: z.string().regex(DATE_RE),
})

export async function getStaffSlotsAction(input: unknown): Promise<ActionResult<{ slots: string[] }>> {
  const parsed = slotsSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { clinicId, doctorId, serviceId, date } = parsed.data
  await requireClinicAccess(clinicId, ...BOOKING_ROLES)

  const [service] = await db
    .select({ durationMinutes: services.durationMinutes })
    .from(doctorServices)
    .innerJoin(services, eq(services.id, doctorServices.serviceId))
    .where(and(eq(doctorServices.doctorId, doctorId), eq(doctorServices.serviceId, serviceId)))
  if (!service) return { ok: false, error: "That doctor doesn't offer this service." }

  const [clinic] = await getScopedClinics(await requireRole(...BOOKING_ROLES)).then((cs) =>
    cs.filter((c) => c.id === clinicId)
  )
  if (!clinic) return { ok: false, error: "Clinic not found." }

  const { start, end } = clinicDayRange(clinic.timezone, date)
  // Reception can fill a gap at short notice, so no lead time (matches createBooking for source "reception").
  const slots: Slot[] = generateSlots({
    ...(await loadSlotInput({ doctorId, clinicId, from: start, to: end, durationMinutes: service.durationMinutes })),
    leadMinutes: 0,
  })
  return { ok: true, data: { slots: slots.map((s) => s.startsAt.toISOString()) } }
}

export type PatientHit = { id: string; name: string; phone: string; dateOfBirth: string | null }

/**
 * Finds existing patients by name or phone. Staff only see patients who have
 * an appointment at one of their own clinics, so searching can't be used to
 * browse the whole patient base.
 */
export async function searchPatientsAction(query: unknown): Promise<ActionResult<{ patients: PatientHit[] }>> {
  const user = await requireRole(...BOOKING_ROLES)
  const q = z.string().trim().min(2).max(60).safeParse(query)
  if (!q.success) return { ok: true, data: { patients: [] } }

  const scoped = await getScopedClinics(user)
  if (scoped.length === 0) return { ok: true, data: { patients: [] } }

  const pattern = `%${q.data.replace(/[\\%_]/g, (m) => "\\" + m)}%`
  const digits = q.data.replace(/\D/g, "")
  const rows = await db
    .selectDistinct({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      phone: patients.phone,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .innerJoin(appointments, eq(appointments.patientId, patients.id))
    .where(
      and(
        inArray(
          appointments.clinicId,
          scoped.map((c) => c.id)
        ),
        or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(sql`${patients.firstName} || ' ' || ${patients.lastName}`, pattern),
          digits.length >= 3
            ? sql`regexp_replace(${patients.phone}, '\\D', '', 'g') like ${"%" + digits + "%"}`
            : undefined
        )
      )
    )
    .limit(8)

  return {
    ok: true,
    data: {
      patients: rows.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        phone: r.phone,
        dateOfBirth: r.dateOfBirth,
      })),
    },
  }
}

export async function createStaffBookingAction(
  input: unknown
): Promise<ActionResult<{ id: string; reference: string }, { alternatives?: string[] }>> {
  const parsed = receptionBookingSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const data = parsed.data
  const user = await requireClinicAccess(data.clinicId, ...BOOKING_ROLES)

  if (!data.patientId && !data.newPatient) {
    return { ok: false, error: "Choose an existing patient or enter new patient details." }
  }

  // A retry of an already-completed request (network blip, double click) returns the original booking
  // instead of creating a second patient and tripping the idempotency check.
  const [prior] = await db
    .select({ id: appointments.id, reference: appointments.reference, clinicId: appointments.clinicId })
    .from(appointments)
    .where(eq(appointments.idempotencyKey, data.idempotencyKey))
  if (prior) {
    if (prior.clinicId !== data.clinicId) return { ok: false, error: "This booking request was already used." }
    return { ok: true, data: { id: prior.id, reference: prior.reference } }
  }

  let patientId = data.patientId
  let createdPatientId: string | null = null
  if (patientId) {
    // Same rule as search: the patient must already be known at one of the user's clinics.
    const scoped = await getScopedClinics(user)
    const [known] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          inArray(
            appointments.clinicId,
            scoped.map((c) => c.id)
          )
        )
      )
      .limit(1)
    if (!known) return { ok: false, error: "We couldn't find that patient. Search again or add them as new." }
  } else if (data.newPatient) {
    const np = data.newPatient
    const [created] = await db
      .insert(patients)
      .values({
        firstName: np.firstName,
        lastName: np.lastName,
        phone: np.phone,
        dateOfBirth: np.dateOfBirth || null,
        email: np.email || null,
      })
      .returning({ id: patients.id })
    patientId = created.id
    createdPatientId = created.id
  }

  const result = await createBooking({
    doctorId: data.doctorId,
    clinicId: data.clinicId,
    serviceId: data.serviceId,
    consultationType: data.consultationType,
    startsAt: new Date(data.startsAt),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey,
    patientId: patientId!,
    source: "reception",
    actor: { id: user.id, role: user.role },
  })
  if (!result.ok) {
    // Don't leave an orphan patient behind when the booking itself didn't happen.
    if (createdPatientId) await db.delete(patients).where(eq(patients.id, createdPatientId))
    const { error } = result
    return {
      ok: false,
      code: error.code,
      error: error.message,
      details:
        "alternatives" in error ? { alternatives: error.alternatives.map((s) => s.startsAt.toISOString()) } : undefined,
    }
  }

  revalidatePath("/staff", "layout")
  return { ok: true, data: { id: result.appointment.id, reference: result.appointment.reference } }
}
