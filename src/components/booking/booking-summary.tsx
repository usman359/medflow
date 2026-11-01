import { CalendarClock, MapPin, Stethoscope, UserRound, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { CONSULTATION_LABELS } from "@/lib/domain"
import { formatDuration, formatInZone, formatPrice, TIMEZONE_ABBR } from "@/lib/format"
import { bookingHref, type BookingParams, type BookingStep } from "@/lib/search-params/booking"
import type { BookingState } from "@/server/booking/flow"

function Row({
  icon: Icon,
  label,
  changeHref,
  children,
}: {
  icon: typeof MapPin
  label: string
  changeHref?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <dl className="min-w-0 flex-1">
        <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </dl>
      {changeHref && (
        <Link
          href={changeHref}
          scroll={false}
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Change<span className="sr-only"> {label.toLowerCase()}</span>
        </Link>
      )}
    </div>
  )
}

export function BookingSummary({ state, params }: { state: BookingState; params: BookingParams }) {
  const { service, doctor, clinic, type, slot } = state
  const change = (step: BookingStep) => (state.step === step ? undefined : bookingHref(params, { step }))

  return (
    <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 id="summary-title" className="text-lg font-semibold">
          Your appointment
        </h2>
        <div className="mt-1 divide-y">
          <Row icon={Stethoscope} label="Service" changeHref={service ? change("service") : undefined}>
            {service ? (
              <>
                <span className="font-medium">{service.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not chosen yet</span>
            )}
          </Row>
          <Row icon={UserRound} label="Doctor" changeHref={doctor ? change("doctor") : undefined}>
            {doctor ? (
              <span className="flex items-center gap-2">
                {doctor.photoUrl && (
                  <Image
                    src={doctor.photoUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-full object-cover object-top"
                  />
                )}
                <span className="font-medium">{doctor.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Not chosen yet</span>
            )}
          </Row>
          <Row
            icon={type === "video" ? Video : MapPin}
            label="Where"
            changeHref={clinic ? change("clinic") : undefined}
          >
            {clinic ? (
              <>
                <span className="font-medium">{clinic.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {type ? CONSULTATION_LABELS[type] : "Visit type not chosen"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not chosen yet</span>
            )}
          </Row>
          <Row icon={CalendarClock} label="When" changeHref={slot ? change("time") : undefined}>
            {slot && clinic ? (
              <>
                <span className="font-medium">{formatInZone(slot.startsAt, clinic.timezone, "EEEE, MMMM d")}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatInZone(slot.startsAt, clinic.timezone, "h:mm a")}–
                  {formatInZone(slot.endsAt, clinic.timezone, "h:mm a")} {TIMEZONE_ABBR[clinic.timezone] ?? ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not chosen yet</span>
            )}
          </Row>
        </div>
      </div>
    </aside>
  )
}
