import { ChevronRight, MapPin, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import type { PatientAppointmentRow } from "@/server/appointments/queries"

/** A whole-row link to one of the patient's appointments. */
export function AppointmentRow({ appointment: a }: { appointment: PatientAppointmentRow }) {
  const tz = a.clinicTimezone
  return (
    <Link
      href={`/account/appointments/${a.id}`}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div
        className="grid w-16 shrink-0 place-items-center rounded-xl bg-secondary py-2 text-secondary-foreground"
        aria-hidden="true"
      >
        <span className="text-xs font-semibold uppercase">{formatInZone(a.startsAt, tz, "MMM")}</span>
        <span className="text-2xl leading-none font-semibold">{formatInZone(a.startsAt, tz, "d")}</span>
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{a.serviceName ?? "Appointment"}</span>
          <StatusBadge status={a.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="sr-only">
            {formatInZone(a.startsAt, tz, "EEEE, MMMM d")}
            {", "}
          </span>
          {formatInZone(a.startsAt, tz, "EEE h:mm a")} {TIMEZONE_ABBR[tz] ?? ""} · {a.doctorName}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {a.consultationType === "video" ? (
            <Video className="size-3.5" aria-hidden="true" />
          ) : (
            <MapPin className="size-3.5" aria-hidden="true" />
          )}
          {a.consultationType === "video" ? "Video call" : a.clinicName}
        </p>
      </div>
      {a.doctorPhotoUrl && (
        <Image
          src={a.doctorPhotoUrl}
          alt=""
          width={48}
          height={48}
          className="hidden size-12 rounded-full object-cover object-top sm:block"
        />
      )}
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  )
}
