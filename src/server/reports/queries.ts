import "server-only"
import { addDays, differenceInCalendarDays, format } from "date-fns"
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { appointments, clinics, doctors, services, specialties } from "@/db/schema"
import { normalizeRange } from "@/lib/report-range"
import type { CurrentUser } from "@/server/auth"
import { clinicDayRange } from "@/server/appointments/staff-queries"
import { loadManagedClinics } from "@/server/settings/queries"

export type ReportFilters = { from: string; to: string; clinic?: string | null }

export type StatusBreakdown = {
  total: number
  completed: number
  cancelled: number
  noShow: number
  open: number
}

export type ReportData = {
  clinics: { slug: string; name: string }[]
  range: { from: string; to: string; days: number }
  totals: StatusBreakdown & {
    noShowRate: number | null
    cancellationRate: number | null
    online: number
    reception: number
  }
  daily: ({ day: string } & StatusBreakdown)[]
  byDoctor: ({ name: string } & StatusBreakdown & { noShowRate: number | null })[]
  bySpecialty: ({ name: string } & StatusBreakdown)[]
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd")
const parse = (v: string) => {
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** `count(*) filter (...)` aggregates shared by every grouping. */
const counts = {
  total: sql<number>`count(*)::int`,
  completed: sql<number>`(count(*) filter (where ${appointments.status} = 'completed'))::int`,
  cancelled: sql<number>`(count(*) filter (where ${appointments.status} = 'cancelled'))::int`,
  noShow: sql<number>`(count(*) filter (where ${appointments.status} = 'no_show'))::int`,
  open: sql<number>`(count(*) filter (where ${appointments.status} in ('requested','confirmed','checked_in')))::int`,
}

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null)

/**
 * Aggregated appointment statistics for the user's clinics. Appointments are
 * counted by the clinic-local day they start on. Everything is computed in
 * SQL; the only JS work is zero-filling days with no appointments.
 */
export async function getReport(user: CurrentUser, filters: ReportFilters, today: string): Promise<ReportData> {
  const managed = await loadManagedClinics(user)
  // Inactive clinics stay in reports: they still have history.
  const selected = filters.clinic ? managed.filter((c) => c.slug === filters.clinic) : managed
  const range = normalizeRange(filters.from, filters.to, today)
  const days = differenceInCalendarDays(parse(range.to), parse(range.from)) + 1

  const empty: ReportData = {
    clinics: managed.map(({ slug, name }) => ({ slug, name })),
    range: { ...range, days },
    totals: {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      open: 0,
      noShowRate: null,
      cancellationRate: null,
      online: 0,
      reception: 0,
    },
    daily: [],
    byDoctor: [],
    bySpecialty: [],
  }
  if (selected.length === 0) return empty

  const inRange = or(
    ...selected.map((c) =>
      and(
        eq(appointments.clinicId, c.id),
        gte(appointments.startsAt, clinicDayRange(c.timezone, range.from).start),
        lt(appointments.startsAt, clinicDayRange(c.timezone, range.to).end)
      )
    )
  )

  const dayExpr = sql<string>`to_char((${appointments.startsAt} at time zone ${clinics.timezone})::date, 'YYYY-MM-DD')`

  const [[totals], dailyRows, doctorRows, specialtyRows] = await Promise.all([
    db
      .select({
        ...counts,
        online: sql<number>`(count(*) filter (where ${appointments.source} = 'online'))::int`,
        reception: sql<number>`(count(*) filter (where ${appointments.source} = 'reception'))::int`,
      })
      .from(appointments)
      .where(inRange),
    db
      .select({ day: dayExpr, ...counts })
      .from(appointments)
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .where(inRange)
      .groupBy(dayExpr)
      .orderBy(asc(dayExpr)),
    db
      .select({ name: doctors.name, ...counts })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .where(inRange)
      .groupBy(doctors.id, doctors.name)
      .orderBy(sql`count(*) desc`, asc(doctors.name)),
    db
      .select({ name: sql<string>`coalesce(${specialties.name}, 'Other')`, ...counts })
      .from(appointments)
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .leftJoin(specialties, eq(specialties.id, services.specialtyId))
      .where(inRange)
      .groupBy(specialties.name)
      .orderBy(sql`count(*) desc`),
  ])

  // Zero-fill the days with nothing booked so the chart has a continuous axis.
  const byDay = new Map(dailyRows.map((r) => [r.day, r]))
  const daily = Array.from({ length: days }, (_, i) => {
    const day = ymd(addDays(parse(range.from), i))
    const r = byDay.get(day)
    return {
      day,
      total: r?.total ?? 0,
      completed: r?.completed ?? 0,
      cancelled: r?.cancelled ?? 0,
      noShow: r?.noShow ?? 0,
      open: r?.open ?? 0,
    }
  })

  return {
    ...empty,
    totals: {
      ...totals,
      // Of the visits that were due, how many did the patient miss; and how many bookings were cancelled.
      noShowRate: rate(totals.noShow, totals.completed + totals.noShow),
      cancellationRate: rate(totals.cancelled, totals.total),
    },
    daily,
    byDoctor: doctorRows.map((r) => ({ ...r, noShowRate: rate(r.noShow, r.completed + r.noShow) })),
    bySpecialty: specialtyRows,
  }
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value)
  // Quote when needed, and defuse spreadsheet formulas (=, +, -, @) in text coming from users.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** One row per appointment in the range, without patient details (reporting only). */
export async function getReportCsv(user: CurrentUser, filters: ReportFilters, today: string): Promise<string> {
  const managed = await loadManagedClinics(user)
  const selected = filters.clinic ? managed.filter((c) => c.slug === filters.clinic) : managed
  const range = normalizeRange(filters.from, filters.to, today)
  const header = [
    "Reference",
    "Date",
    "Start",
    "End",
    "Clinic",
    "Doctor",
    "Specialty",
    "Service",
    "Visit type",
    "Status",
    "Booked via",
  ]
  if (selected.length === 0) return header.join(",") + "\r\n"

  const inRange = or(
    ...selected.map((c) =>
      and(
        eq(appointments.clinicId, c.id),
        gte(appointments.startsAt, clinicDayRange(c.timezone, range.from).start),
        lt(appointments.startsAt, clinicDayRange(c.timezone, range.to).end)
      )
    )
  )
  const local = (fmt: string) => sql<string>`to_char(${appointments.startsAt} at time zone ${clinics.timezone}, ${fmt})`
  const rows = await db
    .select({
      reference: appointments.reference,
      date: local("YYYY-MM-DD"),
      start: local("HH24:MI"),
      end: sql<string>`to_char(${appointments.endsAt} at time zone ${clinics.timezone}, 'HH24:MI')`,
      clinic: clinics.name,
      doctor: doctors.name,
      specialty: specialties.name,
      service: services.name,
      type: appointments.consultationType,
      status: appointments.status,
      source: appointments.source,
    })
    .from(appointments)
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(specialties, eq(specialties.id, services.specialtyId))
    .where(
      and(
        inRange,
        inArray(
          appointments.clinicId,
          selected.map((c) => c.id)
        )
      )
    )
    .orderBy(asc(appointments.startsAt))

  const lines = rows.map((r) =>
    [r.reference, r.date, r.start, r.end, r.clinic, r.doctor, r.specialty, r.service, r.type, r.status, r.source]
      .map(csvCell)
      .join(",")
  )
  return [header.join(","), ...lines].join("\r\n") + "\r\n"
}
