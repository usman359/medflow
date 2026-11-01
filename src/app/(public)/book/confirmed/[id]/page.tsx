import { CalendarPlus, Clock, MapPin, Phone, Video } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Fact } from "@/components/facts"
import { ConfirmedIllustration } from "@/components/illustrations/confirmed"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { CONSULTATION_LABELS } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { getAppointmentForUser } from "@/server/appointments/queries"
import { requireUser } from "@/server/auth"

export const metadata: Metadata = { title: "Booking confirmed" }

export default async function BookingConfirmedPage({ params }: PageProps<"/book/confirmed/[id]">) {
  const user = await requireUser()
  const appt = await getAppointmentForUser((await params).id, user)
  if (!appt) notFound()

  const tz = appt.clinicTimezone
  const confirmed = appt.status === "confirmed"

  return (
    <div className="container-page grid max-w-3xl gap-8 py-10 md:py-16">
      <div className="grid justify-items-center gap-4 text-center">
        <ConfirmedIllustration className="h-36 w-auto" />
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {confirmed ? "You're booked in!" : "Booking request received"}
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          {confirmed
            ? "Your appointment is confirmed. We've sent the details to your email."
            : "The clinic will confirm your appointment shortly. We'll let you know by email and in your account."}
        </p>
        <p className="text-sm text-muted-foreground">
          Reference <span className="font-mono font-semibold text-foreground">{appt.reference}</span>
        </p>
      </div>

      <section aria-label="Appointment details" className="grid gap-5 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{appt.serviceName ?? "Appointment"}</h2>
            <p className="text-muted-foreground">
              with {appt.doctorName}, {appt.doctorTitle}
            </p>
          </div>
          <StatusBadge status={appt.status} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Fact icon={Clock} label="When" hideLabel>
            <dd className="font-medium">{formatInZone(appt.startsAt, tz, "EEEE, MMMM d, yyyy")}</dd>
            <dd className="text-muted-foreground">
              {formatInZone(appt.startsAt, tz, "h:mm a")}–{formatInZone(appt.endsAt, tz, "h:mm a")}{" "}
              {TIMEZONE_ABBR[tz] ?? ""}
            </dd>
          </Fact>
          <Fact icon={appt.consultationType === "video" ? Video : MapPin} label="Where" hideLabel>
            <dd className="font-medium">
              {CONSULTATION_LABELS[appt.consultationType]} · {appt.clinicName}
            </dd>
            <dd className="text-muted-foreground">
              {appt.consultationType === "video"
                ? "We'll email a secure video link before your visit."
                : `${appt.clinicAddress}, ${appt.clinicCity}`}
            </dd>
          </Fact>
          <Fact icon={Phone} label="Clinic phone" hideLabel>
            <dd className="text-muted-foreground">
              Questions? Call{" "}
              <a href={`tel:${appt.clinicPhone.replace(/[^\d+]/g, "")}`} className="font-medium text-foreground">
                {appt.clinicPhone}
              </a>
            </dd>
          </Fact>
        </div>
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button asChild>
            <a href={`/api/appointments/${appt.id}/ics`} download>
              <CalendarPlus aria-hidden="true" /> Add to calendar
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/account/appointments/${appt.id}`}>View or manage</Link>
          </Button>
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Need to change something? You can cancel online from your account until the appointment starts.
      </p>
    </div>
  )
}
