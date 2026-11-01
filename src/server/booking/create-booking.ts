import "server-only"
import { and, eq } from "drizzle-orm"
import { randomInt } from "node:crypto"
import { db } from "@/db"
import { appointments, clinics, doctorClinics, doctors, doctorServices, patients, services, user } from "@/db/schema"
import type { AppointmentStatus, ConsultationType, Role } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { recordAudit } from "@/server/audit"
import { getAvailableSlots, loadAvailability, MAX_BOOKING_WINDOW_DAYS } from "@/server/availability/queries"
import { isGeneratedSlot, type Slot } from "@/server/availability/slots"
import { PG_EXCLUSION_VIOLATION, PG_UNIQUE_VIOLATION, pgError } from "@/server/db-errors"
import { createNotification } from "@/server/notifications"

/**
 * The single write path for new appointments (online and reception).
 *
 * Safety layers, outermost first:
 *  1. Idempotency: a repeated key returns the original appointment, so double
 *     clicks and network retries never create a second booking.
 *  2. Validation: the doctor works at the clinic, offers the service and visit
 *     type, and the start time is a real slot on their schedule (not time off,
 *     not in the past, inside the booking window).
 *  3. The database: GiST exclusion constraints reject any overlap for the same
 *     doctor or patient, even between concurrent transactions. We translate
 *     those errors into SLOT_TAKEN / PATIENT_CONFLICT with fresh alternatives.
 */

export type BookingActor = { id: string; role: Role }

export type CreateBookingParams = {
  doctorId: string
  clinicId: string
  serviceId: string
  consultationType: ConsultationType
  startsAt: Date
  reason: string
  idempotencyKey: string
  patientId: string
  source: "online" | "reception"
  actor: BookingActor
  now?: Date
}

export type BookedAppointment = {
  id: string
  reference: string
  status: AppointmentStatus
  startsAt: Date
  endsAt: Date
}

export type BookingError =
  | { code: "SLOT_TAKEN"; message: string; alternatives: Slot[] }
  | { code: "INVALID_SLOT"; message: string; alternatives: Slot[] }
  | { code: "PATIENT_CONFLICT"; message: string }
  | { code: "NOT_BOOKABLE"; message: string }
  | { code: "IDEMPOTENCY_CONFLICT"; message: string }

export type BookingResult =
  { ok: true; appointment: BookedAppointment; replayed: boolean } | { ok: false; error: BookingError }

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function newReference() {
  return "MF-" + Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("")
}

const appointmentColumns = {
  id: appointments.id,
  reference: appointments.reference,
  status: appointments.status,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  patientId: appointments.patientId,
}

async function findByIdempotencyKey(key: string) {
  const [row] = await db.select(appointmentColumns).from(appointments).where(eq(appointments.idempotencyKey, key))
  return row ?? null
}

function replay(existing: NonNullable<Awaited<ReturnType<typeof findByIdempotencyKey>>>, patientId: string) {
  if (existing.patientId !== patientId) {
    return {
      ok: false as const,
      error: {
        code: "IDEMPOTENCY_CONFLICT" as const,
        message: "This booking request was already used. Please start again.",
      },
    }
  }
  const { id, reference, status, startsAt, endsAt } = existing
  return { ok: true as const, appointment: { id, reference, status, startsAt, endsAt }, replayed: true }
}

/** The next free slots for the same doctor and clinic, starting near the requested time. */
async function alternativesFor(p: CreateBookingParams, durationMinutes: number): Promise<Slot[]> {
  const from = new Date(Math.max(Date.now(), p.startsAt.getTime() - 3 * 60 * MINUTE))
  const slots = await getAvailableSlots({
    doctorId: p.doctorId,
    clinicId: p.clinicId,
    from,
    to: new Date(from.getTime() + 14 * DAY),
    durationMinutes,
  })
  return slots.slice(0, 6)
}

export async function createBooking(p: CreateBookingParams): Promise<BookingResult> {
  const now = p.now ?? new Date()

  // 1. Idempotent replay.
  const existing = await findByIdempotencyKey(p.idempotencyKey)
  if (existing) return replay(existing, p.patientId)

  // 2. Catalog checks: everything must exist, be active and belong together.
  const [ctx] = await db
    .select({
      doctorName: doctors.name,
      consultationTypes: doctors.consultationTypes,
      clinicName: clinics.name,
      timezone: clinics.timezone,
      autoConfirmOnline: clinics.autoConfirmOnline,
      serviceName: services.name,
      durationMinutes: services.durationMinutes,
    })
    .from(doctors)
    .innerJoin(doctorClinics, and(eq(doctorClinics.doctorId, doctors.id), eq(doctorClinics.clinicId, p.clinicId)))
    .innerJoin(clinics, and(eq(clinics.id, doctorClinics.clinicId), eq(clinics.isActive, true)))
    .innerJoin(doctorServices, and(eq(doctorServices.doctorId, doctors.id), eq(doctorServices.serviceId, p.serviceId)))
    .innerJoin(services, and(eq(services.id, doctorServices.serviceId), eq(services.isActive, true)))
    .where(and(eq(doctors.id, p.doctorId), eq(doctors.isActive, true)))

  if (!ctx || !ctx.consultationTypes.includes(p.consultationType)) {
    return {
      ok: false,
      error: {
        code: "NOT_BOOKABLE",
        message: "That doctor doesn't offer this service at this clinic. Please start again.",
      },
    }
  }

  const [patient] = await db
    .select({ id: patients.id, userId: patients.userId, email: patients.email, userEmail: user.email })
    .from(patients)
    .leftJoin(user, eq(user.id, patients.userId))
    .where(eq(patients.id, p.patientId))
  if (!patient) {
    return { ok: false, error: { code: "NOT_BOOKABLE", message: "We couldn't find that patient record." } }
  }

  const startsAt = p.startsAt
  const endsAt = new Date(startsAt.getTime() + ctx.durationMinutes * MINUTE)

  // 3. The start must be a real slot on the doctor's schedule. Appointments are
  //    left out here on purpose: an overlap is reported as SLOT_TAKEN below.
  const window = { from: new Date(startsAt.getTime() - DAY), to: new Date(endsAt.getTime() + DAY) }
  const availability = await loadAvailability({ doctorId: p.doctorId, clinicId: p.clinicId, ...window })
  const onGrid =
    startsAt.getTime() <= now.getTime() + MAX_BOOKING_WINDOW_DAYS * DAY &&
    isGeneratedSlot(
      {
        rules: availability.rules,
        busy: availability.timeOff,
        ...window,
        durationMinutes: ctx.durationMinutes,
        now,
        // Reception can fill a gap at short notice; patients need an hour's notice.
        leadMinutes: p.source === "reception" ? 0 : 60,
      },
      p.clinicId,
      startsAt
    )
  if (!onGrid) {
    return {
      ok: false,
      error: {
        code: "INVALID_SLOT",
        message: "That time isn't available for booking. Please choose one of the times below.",
        alternatives: await alternativesFor(p, ctx.durationMinutes),
      },
    }
  }

  // Friendly early check; the exclusion constraint remains the real guarantee.
  if (availability.booked.some((b) => startsAt < b.endsAt && b.startsAt < endsAt)) {
    return {
      ok: false,
      error: {
        code: "SLOT_TAKEN",
        message: "Sorry, someone has just booked that time. Here are the next available times.",
        alternatives: await alternativesFor(p, ctx.durationMinutes),
      },
    }
  }

  const status: AppointmentStatus = p.source === "reception" || ctx.autoConfirmOnline ? "confirmed" : "requested"
  const when =
    `${formatInZone(startsAt, ctx.timezone, "EEEE, MMMM d 'at' h:mm a")} ${TIMEZONE_ABBR[ctx.timezone] ?? ""}`.trim()

  // 4. Insert. Retry only on the (astronomically rare) reference collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { appointment, deliver } = await db.transaction(async (tx) => {
        const [appointment] = await tx
          .insert(appointments)
          .values({
            reference: newReference(),
            patientId: p.patientId,
            doctorId: p.doctorId,
            clinicId: p.clinicId,
            serviceId: p.serviceId,
            consultationType: p.consultationType,
            startsAt,
            endsAt,
            status,
            source: p.source,
            reason: p.reason,
            idempotencyKey: p.idempotencyKey,
            createdByUserId: p.actor.id,
            confirmedAt: status === "confirmed" ? now : null,
          })
          .returning({
            id: appointments.id,
            reference: appointments.reference,
            status: appointments.status,
            startsAt: appointments.startsAt,
            endsAt: appointments.endsAt,
          })

        await recordAudit(tx, {
          actor: p.actor,
          entityType: "appointment",
          entityId: appointment.id,
          action: "created",
          toStatus: status,
          metadata: { source: p.source, reference: appointment.reference },
        })

        const deliver = patient.userId
          ? await createNotification(
              tx,
              {
                userId: patient.userId,
                type: status === "confirmed" ? "appointment_confirmed" : "appointment_requested",
                title: status === "confirmed" ? "Your appointment is confirmed" : "We received your booking request",
                body:
                  status === "confirmed"
                    ? `${ctx.serviceName} with ${ctx.doctorName} at ${ctx.clinicName}, ${when}. Reference ${appointment.reference}.`
                    : `${ctx.serviceName} with ${ctx.doctorName} at ${ctx.clinicName}, ${when}. The clinic will confirm shortly. Reference ${appointment.reference}.`,
                link: `/account/appointments/${appointment.id}`,
              },
              patient.email ?? patient.userEmail
            )
          : null

        return { appointment, deliver }
      })

      await deliver?.()
      return { ok: true, appointment, replayed: false }
    } catch (error) {
      const { code, constraint } = pgError(error)
      if (code === PG_UNIQUE_VIOLATION && constraint?.includes("idempotency")) {
        const original = await findByIdempotencyKey(p.idempotencyKey)
        if (original) return replay(original, p.patientId)
      }
      if (code === PG_UNIQUE_VIOLATION && constraint?.includes("reference")) continue
      if (code === PG_EXCLUSION_VIOLATION) {
        if (constraint === "appointments_patient_no_overlap") {
          return {
            ok: false,
            error: {
              code: "PATIENT_CONFLICT",
              message: "You already have an appointment that overlaps this time. Please choose a different time.",
            },
          }
        }
        return {
          ok: false,
          error: {
            code: "SLOT_TAKEN",
            message: "Sorry, someone has just booked that time. Here are the next available times.",
            alternatives: await alternativesFor(p, ctx.durationMinutes),
          },
        }
      }
      throw error
    }
  }
  throw new Error("Could not allocate a unique booking reference")
}
