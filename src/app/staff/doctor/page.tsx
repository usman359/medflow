import { addDays, differenceInYears, format, startOfWeek } from "date-fns"
import type { Metadata } from "next"
import { AppointmentDrawer, type DrawerAppointment } from "@/components/doctor/appointment-drawer"
import { DoctorToolbar } from "@/components/doctor/doctor-toolbar"
import { DayAgenda, WeekGrid, type WeekDay } from "@/components/doctor/schedule-views"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { availableTransitions } from "@/lib/appointment-state"
import { currentTime, formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { DATE_RE } from "@/lib/search-params/reception"
import { loadDoctorScheduleParams, serializeDoctorSchedule } from "@/lib/search-params/doctor"
import {
  getDoctorAppointmentDetail,
  getDoctorContext,
  listDoctorAppointments,
} from "@/server/appointments/doctor-queries"
import { clinicDayRange } from "@/server/appointments/staff-queries"
import { requireRole } from "@/server/auth"

export const metadata: Metadata = { title: "My schedule" }

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export default async function DoctorSchedulePage({ searchParams }: PageProps<"/staff/doctor">) {
  const user = await requireRole("doctor")
  const params = await loadDoctorScheduleParams(searchParams)
  const ctx = await getDoctorContext(user)

  if (!ctx) {
    return (
      <>
        <PageHeader title="My schedule" />
        <EmptyState
          title="Your account isn't linked to a doctor profile"
          description="Ask a system administrator to link your login to your doctor profile so your appointments appear here."
        />
      </>
    )
  }

  const tz = ctx.clinics[0]?.timezone ?? "America/New_York"
  const now = currentTime()
  const today = formatInZone(now, tz, "yyyy-MM-dd")
  const date = params.date && DATE_RE.test(params.date) ? params.date : today
  const day = parseYmd(date)
  const weekStart = startOfWeek(day, { weekStartsOn: 1 })
  const view = params.view

  const range =
    view === "week"
      ? {
          start: clinicDayRange(tz, format(weekStart, "yyyy-MM-dd")).start,
          end: clinicDayRange(tz, format(addDays(weekStart, 7), "yyyy-MM-dd")).start,
        }
      : clinicDayRange(tz, date)

  const [rows, detail] = await Promise.all([
    listDoctorAppointments(ctx.doctorId, range.start, range.end),
    params.appt ? getDoctorAppointmentDetail(user, params.appt) : null,
  ])

  const href = (changes: { appt?: string | null; view?: "day" | "week"; date?: string | null }) => {
    const nextDate = "date" in changes ? changes.date : date
    return serializeDoctorSchedule("/staff/doctor", {
      view: changes.view ?? view,
      date: nextDate && nextDate !== today ? nextDate : null,
      appt: "appt" in changes ? (changes.appt ?? null) : null,
    })
  }

  const zones = new Set(ctx.clinics.map((c) => c.timezone))
  const showClinic = ctx.clinics.length > 1
  const showZone = zones.size > 1

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const key = format(d, "yyyy-MM-dd")
    return {
      key,
      label: format(d, "EEEE, MMMM d"),
      short: format(d, "EEE d"),
      isToday: key === today,
      rows: rows.filter((r) => formatInZone(r.startsAt, tz, "yyyy-MM-dd") === key),
    }
  })

  const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "no_show")
  const stats = [
    { label: "Appointments", value: active.length },
    { label: "Waiting", value: rows.filter((r) => r.status === "checked_in").length },
    { label: "Completed", value: rows.filter((r) => r.status === "completed").length },
    {
      label: "Still to come",
      value: rows.filter((r) => ["requested", "confirmed"].includes(r.status) && r.endsAt > now).length,
    },
  ]

  let drawer: DrawerAppointment | null = null
  if (detail) {
    const dtz = detail.clinicTimezone
    drawer = {
      id: detail.id,
      reference: detail.reference,
      status: detail.status,
      consultationType: detail.consultationType,
      reason: detail.reason,
      service: detail.serviceName,
      when: `${formatInZone(detail.startsAt, dtz, "EEE, MMM d · h:mm a")}–${formatInZone(detail.endsAt, dtz, "h:mm a")} ${TIMEZONE_ABBR[dtz] ?? ""}`.trim(),
      clinic: detail.clinicName,
      patient: {
        name: `${detail.patientFirstName} ${detail.patientLastName}`,
        phone: detail.patientPhone,
        dob: detail.patientDateOfBirth,
        age: detail.patientDateOfBirth ? differenceInYears(now, parseYmd(detail.patientDateOfBirth)) : null,
      },
      notesOpen: detail.status === "checked_in" || detail.status === "completed",
      note: detail.note?.body ?? "",
      noteSavedAt: detail.note ? formatInZone(detail.note.updatedAt, dtz, "MMM d, h:mm a") : null,
      transitions: availableTransitions(detail.status, { role: "doctor", startsAt: detail.startsAt, now }),
      history: detail.history.map((h) => ({
        id: h.id,
        when: formatInZone(h.startsAt, h.clinicTimezone, "MMM d, yyyy"),
        status: h.status,
        service: h.serviceName,
        reason: h.reason,
        note: h.note,
      })),
    }
  }

  const subtitle =
    view === "week"
      ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
      : format(day, "EEEE, MMMM d, yyyy")

  return (
    <>
      <PageHeader title="My schedule" description={`${ctx.name} · ${subtitle}`} />
      <DoctorToolbar today={today} date={date} />

      {view === "day" && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="text-2xl font-semibold text-teal-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {view === "week" ? (
        <WeekGrid days={weekDays} href={href} showZone={showZone} />
      ) : rows.length ? (
        <DayAgenda rows={rows} href={href} showClinic={showClinic} showZone={showZone} now={now} />
      ) : (
        <EmptyState
          title="Nothing booked for this day"
          description="Appointments booked online or by reception will appear here."
        />
      )}

      {drawer && <AppointmentDrawer appt={drawer} closeHref={href({ appt: null })} />}
    </>
  )
}
