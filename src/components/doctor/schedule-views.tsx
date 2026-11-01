import { NotebookPen, Video } from "lucide-react"
import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DoctorAppointmentRow } from "@/server/appointments/doctor-queries"

type Common = {
  /** Builds a link to this schedule with changes applied (keeps view/date). */
  href: (changes: { appt?: string | null; view?: "day" | "week"; date?: string | null }) => string
  showClinic: boolean
  showZone: boolean
}

function timeLabel(row: DoctorAppointmentRow, showZone: boolean) {
  const start = formatInZone(row.startsAt, row.clinicTimezone, "h:mm a")
  const zone = showZone ? ` ${TIMEZONE_ABBR[row.clinicTimezone] ?? ""}` : ""
  return `${start}${zone}`
}

export function DayAgenda({
  rows,
  href,
  showClinic,
  showZone,
  now,
}: Common & { rows: DoctorAppointmentRow[]; now: Date }) {
  return (
    <ol className="grid gap-3">
      {rows.map((row) => {
        const inProgress = row.status === "checked_in"
        const upcoming = row.endsAt > now && ["requested", "confirmed"].includes(row.status)
        return (
          <li key={row.id}>
            <Link
              href={href({ appt: row.id })}
              scroll={false}
              className={cn(
                "grid gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm sm:grid-cols-[7rem_1fr_auto] sm:items-center",
                inProgress && "border-(--status-checked-in) ring-1 ring-(--status-checked-in)/30"
              )}
            >
              <div>
                <p className="font-semibold text-teal-900">{timeLabel(row, showZone)}</p>
                <p className="text-sm text-muted-foreground">
                  {Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60000)} min
                </p>
              </div>
              <div className="grid gap-0.5">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {row.patientName}
                  {row.consultationType === "video" && (
                    <Video className="size-4 text-primary" aria-label="Video visit" />
                  )}
                  {row.hasNote && <NotebookPen className="size-4 text-muted-foreground" aria-label="Has visit note" />}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.serviceName ?? "Appointment"}
                  {showClinic ? ` · ${row.clinicName.replace(/^MedFlow\s+/, "")}` : ""}
                </p>
                <p className="line-clamp-1 text-sm text-muted-foreground">{row.reason}</p>
              </div>
              <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                <StatusBadge status={row.status} />
                {inProgress && <span className="text-xs font-medium text-(--status-checked-in)">Waiting for you</span>}
                {upcoming && row.startsAt <= now && <span className="text-xs text-muted-foreground">Due now</span>}
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

export type WeekDay = { key: string; label: string; short: string; isToday: boolean; rows: DoctorAppointmentRow[] }

export function WeekGrid({ days, href, showZone }: Pick<Common, "href" | "showZone"> & { days: WeekDay[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-7">
      {days.map((day) => (
        <li
          key={day.key}
          className={cn(
            "grid content-start gap-2 rounded-2xl border bg-card p-3",
            day.isToday && "border-primary ring-1 ring-primary/30"
          )}
        >
          <Link
            href={href({ view: "day", date: day.key, appt: null })}
            className="flex items-baseline justify-between gap-2 rounded-md hover:underline"
          >
            <span className="font-semibold text-teal-900">
              {day.short}
              <span className="sr-only">, {day.label}</span>
            </span>
            <span className="text-xs text-muted-foreground">{day.rows.length}</span>
          </Link>
          {day.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Free</p>
          ) : (
            <ul className="grid gap-1.5">
              {day.rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={href({ view: "day", date: day.key, appt: row.id })}
                    scroll={false}
                    className="grid gap-0.5 rounded-lg bg-muted/60 px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className="flex items-center justify-between gap-1 font-medium whitespace-nowrap">
                      {timeLabel(row, showZone)}
                      <StatusDot status={row.status} />
                    </span>
                    <span className="truncate text-muted-foreground">{row.patientName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

const DOT: Record<DoctorAppointmentRow["status"], string> = {
  requested: "bg-(--status-requested)",
  confirmed: "bg-(--status-confirmed)",
  checked_in: "bg-(--status-checked-in)",
  completed: "bg-(--status-completed)",
  cancelled: "bg-(--status-cancelled)",
  no_show: "bg-(--status-no-show)",
}

/** A compact status marker for dense views. The name is always available to screen readers and on hover. */
function StatusDot({ status }: { status: DoctorAppointmentRow["status"] }) {
  const label = status.replace("_", " ")
  return (
    <span className="inline-flex items-center" title={label}>
      <span className={cn("size-2.5 rounded-full", DOT[status])} aria-hidden="true" />
      <span className="sr-only capitalize">{label}</span>
    </span>
  )
}
