import "server-only"
import { asc, eq } from "drizzle-orm"
import { cache } from "react"
import { db, type DbOrTx } from "@/db"
import { appointments, clinics, doctors, patients, services } from "@/db/schema"
import type { AppointmentStatus, ConsultationType } from "@/lib/domain"
import type { CurrentUser } from "@/server/auth"
import { canViewAppointment } from "./access"

const detailColumns = {
  id: appointments.id,
  reference: appointments.reference,
  status: appointments.status,
  source: appointments.source,
  consultationType: appointments.consultationType,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  reason: appointments.reason,
  cancelledReason: appointments.cancelledReason,
  createdAt: appointments.createdAt,
  clinicId: appointments.clinicId,
  doctorId: appointments.doctorId,
  patientId: appointments.patientId,
  patientUserId: patients.userId,
  patientFirstName: patients.firstName,
  patientLastName: patients.lastName,
  patientPhone: patients.phone,
  patientEmail: patients.email,
  patientDateOfBirth: patients.dateOfBirth,
  doctorName: doctors.name,
  doctorSlug: doctors.slug,
  doctorTitle: doctors.title,
  doctorPhotoUrl: doctors.photoUrl,
  clinicName: clinics.name,
  clinicAddress: clinics.addressLine,
  clinicCity: clinics.city,
  clinicPhone: clinics.phone,
  clinicTimezone: clinics.timezone,
  serviceName: services.name,
  serviceDurationMinutes: services.durationMinutes,
  servicePriceCents: services.priceCents,
}

/** Uncached, unauthenticated read. Callers must check access (see getAppointmentForUser). */
export async function loadAppointmentDetail(id: string, conn: DbOrTx = db) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await conn
    .select(detailColumns)
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.id, id))
  return row ?? null
}

/** One appointment with everything needed to display it, or null when it doesn't exist or the user may not see it. */
export const getAppointmentForUser = cache(async (id: string, user: CurrentUser) => {
  const row = await loadAppointmentDetail(id)
  if (!row) return null
  return (await canViewAppointment(user, row)) ? row : null
})

export type AppointmentDetail = NonNullable<Awaited<ReturnType<typeof loadAppointmentDetail>>>

const listColumns = {
  id: appointments.id,
  reference: appointments.reference,
  status: appointments.status,
  consultationType: appointments.consultationType,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  doctorName: doctors.name,
  doctorTitle: doctors.title,
  doctorPhotoUrl: doctors.photoUrl,
  clinicName: clinics.name,
  clinicTimezone: clinics.timezone,
  serviceName: services.name,
}

export type PatientAppointmentRow = {
  id: string
  reference: string
  status: AppointmentStatus
  consultationType: ConsultationType
  startsAt: Date
  endsAt: Date
  doctorName: string
  doctorTitle: string
  doctorPhotoUrl: string | null
  clinicName: string
  clinicTimezone: string
  serviceName: string | null
}

/** A patient's own appointments, split into upcoming (soonest first) and past (latest first). */
export async function listPatientAppointments(
  userId: string
): Promise<{ upcoming: PatientAppointmentRow[]; past: PatientAppointmentRow[] }> {
  const rows: PatientAppointmentRow[] = await db
    .select(listColumns)
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(patients.userId, userId))
    .orderBy(asc(appointments.startsAt))

  const now = Date.now()
  const isUpcoming = (r: PatientAppointmentRow) =>
    r.endsAt.getTime() > now && r.status !== "cancelled" && r.status !== "no_show" && r.status !== "completed"
  return {
    upcoming: rows.filter(isUpcoming),
    past: rows.filter((r) => !isUpcoming(r)).reverse(),
  }
}
