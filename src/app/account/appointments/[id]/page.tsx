import { ArrowLeft, CalendarPlus, Clock, MapPin, Phone, Stethoscope, Video } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StatusActions } from "@/components/appointments/status-actions"
import { Fact } from "@/components/facts"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { availableTransitions } from "@/lib/appointment-state"
import { CONSULTATION_LABELS } from "@/lib/domain"
import { formatDuration, formatInZone, formatPrice, hasPassed, TIMEZONE_ABBR } from "@/lib/format"
import { getAppointmentForUser } from "@/server/appointments/queries"
import { requireRole } from "@/server/auth"

export const metadata: Metadata = { title: "Appointment" }

export default async function AppointmentDetailPage({ params }: PageProps<"/account/appointments/[id]">) {
  const user = await requireRole("patient")
  const appt = await getAppointmentForUser((await params).id, user)
  if (!appt) notFound()

  const tz = appt.clinicTimezone
  const transitions = availableTransitions(appt.status, { role: "patient", isOwner: true, startsAt: appt.startsAt })
  const isPast = hasPassed(appt.endsAt)
  const closed = appt.status === "cancelled" || appt.status === "no_show" || appt.status === "completed"

  return (
    <>
      <Button asChild variant="ghost" className="-ml-3 w-fit">
        <Link href="/account/appointments">
          <ArrowLeft aria-hidden="true" /> All appointments
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">{appt.serviceName ?? "Appointment"}</h1>
          <p className="text-muted-foreground">
            with {appt.doctorName}, {appt.doctorTitle}
          </p>
        </div>
        <StatusBadge status={appt.status} className="text-sm" />
      </header>

      {appt.status === "cancelled" && (
        <p className="rounded-2xl bg-muted p-4 text-sm">
          This appointment was cancelled{appt.cancelledReason ? `: ${appt.cancelledReason}` : "."}
        </p>
      )}
      {appt.status === "requested" && (
        <p className="rounded-2xl bg-(--status-requested-bg) p-4 text-sm text-(--status-requested)">
          Waiting for the clinic to confirm. We&apos;ll notify you as soon as they do.
        </p>
      )}

      <section aria-label="Appointment details" className="grid gap-6 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          <Fact icon={Clock} label="When">
            <dd className="font-medium">{formatInZone(appt.startsAt, tz, "EEEE, MMMM d, yyyy")}</dd>
            <dd className="text-muted-foreground">
              {formatInZone(appt.startsAt, tz, "h:mm a")}–{formatInZone(appt.endsAt, tz, "h:mm a")}{" "}
              {TIMEZONE_ABBR[tz] ?? ""}
            </dd>
          </Fact>
          <Fact icon={appt.consultationType === "video" ? Video : MapPin} label="Where">
            <dd className="font-medium">
              {CONSULTATION_LABELS[appt.consultationType]} · {appt.clinicName}
            </dd>
            <dd className="text-muted-foreground">
              {appt.consultationType === "video"
                ? "A secure link is emailed before your visit."
                : `${appt.clinicAddress}, ${appt.clinicCity}`}
            </dd>
          </Fact>
          <Fact icon={Stethoscope} label="Service">
            <dd className="font-medium">{appt.serviceName ?? "—"}</dd>
            {appt.serviceDurationMinutes != null && appt.servicePriceCents != null && (
              <dd className="text-muted-foreground">
                {formatDuration(appt.serviceDurationMinutes)} · {formatPrice(appt.servicePriceCents)}
              </dd>
            )}
          </Fact>
          <Fact icon={Phone} label="Clinic phone">
            <dd className="font-medium">
              <a href={`tel:${appt.clinicPhone.replace(/[^\d+]/g, "")}`}>{appt.clinicPhone}</a>
            </dd>
          </Fact>
          <Fact label="Reason for visit" className="sm:col-span-2">
            <dd>{appt.reason}</dd>
          </Fact>
          <Fact label="Reference">
            <dd className="font-mono font-semibold">{appt.reference}</dd>
          </Fact>
        </div>

        <div className="flex flex-wrap gap-3 border-t pt-5">
          {!closed && !isPast && (
            <Button asChild variant="outline">
              <a href={`/api/appointments/${appt.id}/ics`} download>
                <CalendarPlus aria-hidden="true" /> Add to calendar
              </a>
            </Button>
          )}
          <StatusActions
            appointmentId={appt.id}
            status={appt.status}
            transitions={transitions}
            cancelLabel="Cancel appointment"
            audience="patient"
          />
          {closed && (
            <Button asChild>
              <Link href={`/book?doctor=${appt.doctorSlug}`}>
                Book again with {appt.doctorName.split(" ").slice(-1)}
              </Link>
            </Button>
          )}
          {!closed && !transitions.includes("cancelled") && !isPast && (
            <p className="self-center text-sm text-muted-foreground">
              To change this appointment now, please call the clinic.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
