import "server-only"
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm"
import { db } from "@/db"
import { appointments, clinics, doctorClinics, doctors, patients, services, visitNotes } from "@/db/schema"
import type { AppointmentStatus, ConsultationType } from "@/lib/domain"
import { getDoctorIdForUser, type CurrentUser } from "@/server/auth"
import { canViewAppointment } from "./access"
import { loadAppointmentDetail } from "./queries"

export type DoctorContext = {
  doctorId: string
  name: string
  clinics: { id: string; name: string; timezone: string }[]
}

/** The signed-in doctor's profile and clinics, or null if their account isn't linked to a doctor profile. */
export async function getDoctorContext(user: CurrentUser): Promise<DoctorContext | null> {
  const doctorId = await getDoctorIdForUser(user.id)
  if (!doctorId) return null
  const [doctor] = await db.select({ name: doctors.name }).from(doctors).where(eq(doctors.id, doctorId))
  const clinicRows = await db
    .select({ id: clinics.id, name: clinics.name, timezone: clinics.timezone })
    .from(doctorClinics)
    .innerJoin(clinics, eq(clinics.id, doctorClinics.clinicId))
    .where(and(eq(doctorClinics.doctorId, doctorId), eq(clinics.isActive, true)))
    .orderBy(asc(clinics.name))
  return { doctorId, name: doctor.name, clinics: clinicRows }
}

export type DoctorAppointmentRow = {
  id: string
  reference: string
  status: AppointmentStatus
  consultationType: ConsultationType
  startsAt: Date
  endsAt: Date
  reason: string
  patientName: string
  clinicName: string
  clinicTimezone: string
  serviceName: string | null
  hasNote: boolean
}

/** A doctor's own appointments in [from, to). The doctor id comes from the session, never from the request. */
export async function listDoctorAppointments(doctorId: string, from: Date, to: Date): Promise<DoctorAppointmentRow[]> {
  const rows = await db
    .select({
      id: appointments.id,
      reference: appointments.reference,
      status: appointments.status,
      consultationType: appointments.consultationType,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      reason: appointments.reason,
      firstName: patients.firstName,
      lastName: patients.lastName,
      clinicName: clinics.name,
      clinicTimezone: clinics.timezone,
      serviceName: services.name,
      noteId: visitNotes.id,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(visitNotes, eq(visitNotes.appointmentId, appointments.id))
    .where(and(eq(appointments.doctorId, doctorId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
    .orderBy(asc(appointments.startsAt))

  return rows.map(({ firstName, lastName, noteId, ...r }) => ({
    ...r,
    patientName: `${firstName} ${lastName}`,
    hasNote: noteId !== null,
  }))
}

export type DoctorAppointmentDetail = NonNullable<Awaited<ReturnType<typeof getDoctorAppointmentDetail>>>

/** One appointment with the patient's history with *this* doctor and any visit note. Null if it isn't theirs. */
export async function getDoctorAppointmentDetail(user: CurrentUser, appointmentId: string) {
  const appt = await loadAppointmentDetail(appointmentId)
  if (!appt || !(await canViewAppointment(user, appt))) return null

  const [[note], history] = await Promise.all([
    db
      .select({ body: visitNotes.body, updatedAt: visitNotes.updatedAt })
      .from(visitNotes)
      .where(eq(visitNotes.appointmentId, appt.id)),
    db
      .select({
        id: appointments.id,
        status: appointments.status,
        startsAt: appointments.startsAt,
        reason: appointments.reason,
        clinicTimezone: clinics.timezone,
        serviceName: services.name,
        note: visitNotes.body,
      })
      .from(appointments)
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .leftJoin(visitNotes, eq(visitNotes.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.patientId, appt.patientId),
          eq(appointments.doctorId, appt.doctorId),
          ne(appointments.id, appt.id),
          lt(appointments.startsAt, appt.startsAt)
        )
      )
      .orderBy(desc(appointments.startsAt))
      .limit(6),
  ])

  return { ...appt, note: note ?? null, history }
}
