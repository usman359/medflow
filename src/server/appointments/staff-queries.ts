import "server-only"
import { and, asc, count, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { appointments, clinics, doctorClinics, doctors, doctorServices, patients, services } from "@/db/schema"
import type { AppointmentStatus, ConsultationType } from "@/lib/domain"
import { clinicDayRange } from "@/lib/clinic-time"
import { getClinicScope, type CurrentUser } from "@/server/auth"

export type StaffAppointmentFilters = {
  date?: string | null
  clinic?: string | null
  doctor?: string | null
  status?: AppointmentStatus | null
  q?: string | null
}

export type StaffAppointmentRow = {
  id: string
  reference: string
  status: AppointmentStatus
  source: "online" | "reception"
  consultationType: ConsultationType
  startsAt: Date
  endsAt: Date
  reason: string
  patientId: string
  patientName: string
  patientPhone: string
  doctorId: string
  doctorName: string
  clinicId: string
  clinicName: string
  clinicTimezone: string
  serviceName: string | null
}

type ScopedClinic = { id: string; slug: string; name: string; timezone: string }

export { clinicDayRange }

/** The clinics this user may work with (active ones only), optionally narrowed to a slug. */
export async function getScopedClinics(user: CurrentUser, slug?: string | null): Promise<ScopedClinic[]> {
  const scope = await getClinicScope(user)
  if (scope !== "all" && scope.length === 0) return []
  return db
    .select({ id: clinics.id, slug: clinics.slug, name: clinics.name, timezone: clinics.timezone })
    .from(clinics)
    .where(
      and(
        eq(clinics.isActive, true),
        scope === "all" ? undefined : inArray(clinics.id, scope),
        slug ? eq(clinics.slug, slug) : undefined
      )
    )
    .orderBy(asc(clinics.name))
}

function searchCondition(q: string): SQL | undefined {
  const term = q.trim()
  if (!term) return undefined
  const pattern = `%${term.replace(/[\\%_]/g, (m) => "\\" + m)}%`
  const digits = term.replace(/\D/g, "")
  return or(
    ilike(patients.firstName, pattern),
    ilike(patients.lastName, pattern),
    ilike(sql`${patients.firstName} || ' ' || ${patients.lastName}`, pattern),
    ilike(appointments.reference, pattern),
    digits.length >= 3 ? sql`regexp_replace(${patients.phone}, '\\D', '', 'g') like ${"%" + digits + "%"}` : undefined
  )
}

/**
 * Appointments for reception / managers / admins. The clinic scope is applied
 * in SQL, so rows from other clinics can never be returned no matter what
 * filters are requested.
 */
export async function listStaffAppointments(user: CurrentUser, filters: StaffAppointmentFilters) {
  const scoped = await getScopedClinics(user, filters.clinic)
  if (scoped.length === 0)
    return { rows: [] as StaffAppointmentRow[], counts: {} as Partial<Record<AppointmentStatus, number>> }

  const dayWindows = or(
    ...scoped.map((c) => {
      const { start, end } = clinicDayRange(c.timezone, filters.date)
      return and(eq(appointments.clinicId, c.id), gte(appointments.startsAt, start), lt(appointments.startsAt, end))
    })
  )

  const base = [
    dayWindows,
    filters.doctor ? eq(doctors.slug, filters.doctor) : undefined,
    searchCondition(filters.q ?? ""),
  ]

  const from = () =>
    db
      .select({
        id: appointments.id,
        reference: appointments.reference,
        status: appointments.status,
        source: appointments.source,
        consultationType: appointments.consultationType,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        reason: appointments.reason,
        patientId: patients.id,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        patientPhone: patients.phone,
        doctorId: doctors.id,
        doctorName: doctors.name,
        clinicId: clinics.id,
        clinicName: clinics.name,
        clinicTimezone: clinics.timezone,
        serviceName: services.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .leftJoin(services, eq(services.id, appointments.serviceId))

  const [rows, countRows] = await Promise.all([
    from()
      .where(and(...base, filters.status ? eq(appointments.status, filters.status) : undefined))
      .orderBy(asc(appointments.startsAt))
      .limit(500),
    db
      .select({ status: appointments.status, n: count() })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .where(and(...base))
      .groupBy(appointments.status),
  ])

  const counts: Partial<Record<AppointmentStatus, number>> = {}
  for (const r of countRows) counts[r.status] = r.n

  return {
    counts,
    rows: rows.map(({ patientFirstName, patientLastName, ...r }) => ({
      ...r,
      patientName: `${patientFirstName} ${patientLastName}`,
    })),
  }
}

/** Doctors who work at the user's clinics, for the filter dropdown. */
export async function listScopedDoctors(user: CurrentUser) {
  const scoped = await getScopedClinics(user)
  if (scoped.length === 0) return []
  return db
    .selectDistinct({ id: doctors.id, slug: doctors.slug, name: doctors.name })
    .from(doctors)
    .innerJoin(doctorClinics, eq(doctorClinics.doctorId, doctors.id))
    .where(
      and(
        eq(doctors.isActive, true),
        inArray(
          doctorClinics.clinicId,
          scoped.map((c) => c.id)
        )
      )
    )
    .orderBy(asc(doctors.name))
}

export type StaffBookingOptions = {
  clinics: {
    id: string
    name: string
    timezone: string
    doctors: {
      id: string
      name: string
      title: string
      consultationTypes: ConsultationType[]
      services: { id: string; name: string; durationMinutes: number }[]
    }[]
  }[]
}

/** Everything the phone / walk-in booking dialog needs, limited to the user's clinics. */
export async function loadStaffBookingOptions(user: CurrentUser): Promise<StaffBookingOptions> {
  const scoped = await getScopedClinics(user)
  if (scoped.length === 0) return { clinics: [] }

  const rows = await db
    .select({
      clinicId: doctorClinics.clinicId,
      doctorId: doctors.id,
      doctorName: doctors.name,
      doctorTitle: doctors.title,
      consultationTypes: doctors.consultationTypes,
      serviceId: services.id,
      serviceName: services.name,
      durationMinutes: services.durationMinutes,
    })
    .from(doctorClinics)
    .innerJoin(doctors, and(eq(doctors.id, doctorClinics.doctorId), eq(doctors.isActive, true)))
    .innerJoin(doctorServices, eq(doctorServices.doctorId, doctors.id))
    .innerJoin(services, and(eq(services.id, doctorServices.serviceId), eq(services.isActive, true)))
    .where(
      inArray(
        doctorClinics.clinicId,
        scoped.map((c) => c.id)
      )
    )
    .orderBy(asc(doctors.name), asc(services.name))

  return {
    clinics: scoped.map((c) => {
      const byDoctor = new Map<string, StaffBookingOptions["clinics"][number]["doctors"][number]>()
      for (const r of rows.filter((x) => x.clinicId === c.id)) {
        const d = byDoctor.get(r.doctorId) ?? {
          id: r.doctorId,
          name: r.doctorName,
          title: r.doctorTitle,
          consultationTypes: r.consultationTypes,
          services: [],
        }
        d.services.push({ id: r.serviceId, name: r.serviceName, durationMinutes: r.durationMinutes })
        byDoctor.set(r.doctorId, d)
      }
      return { id: c.id, name: c.name, timezone: c.timezone, doctors: [...byDoctor.values()] }
    }),
  }
}
