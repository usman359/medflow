import { AlertTriangle, Clock, MapPin, Phone, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { SpecialtyIcon } from "@/components/doctors/specialty-icon"
import { EmptyState } from "@/components/illustrations/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CONSULTATION_LABELS, type ConsultationType } from "@/lib/domain"
import { formatDuration, formatInZone, formatPrice, TIMEZONE_ABBR } from "@/lib/format"
import { bookingHref, type BookingParams } from "@/lib/search-params/booking"
import { cn } from "@/lib/utils"
import type { CurrentUser } from "@/server/auth"
import type { BookingState } from "@/server/booking/flow"
import { BookingAuthPanel } from "./auth-panel"
import { ConfirmBooking } from "./confirm-booking"
import { BookingDatePicker } from "./date-picker"
import { OptionCard } from "./option-card"
import { PatientDetailsForm } from "./patient-details-form"

type StepProps = { state: BookingState; params: BookingParams }

export function StepHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-1">
      <h2 id="step-title" className="text-2xl font-semibold" tabIndex={-1}>
        {title}
      </h2>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}

/* ---------------------------------------------------------------- Service */

export function ServiceStep({ state, params }: StepProps) {
  const { catalog, presetDoctor, service } = state

  if (presetDoctor) {
    // Doctor chosen first (e.g. from their profile): show only what they offer.
    return (
      <>
        <StepHeading
          title={`What would you like to see ${presetDoctor.name} for?`}
          description="Pick the service that best matches your visit."
        />
        <ul className="grid gap-3">
          {presetDoctor.services.map((svc) => (
            <li key={svc.id}>
              <OptionCard href={bookingHref(params, { service: svc.slug })} selected={service?.id === svc.id}>
                <div className="grid gap-0.5">
                  <span className="font-semibold">{svc.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(svc.durationMinutes)} · {formatPrice(svc.priceCents)}
                  </span>
                </div>
              </OptionCard>
            </li>
          ))}
        </ul>
      </>
    )
  }

  const activeSpecialty = params.specialty ?? service?.specialty.slug ?? null
  const groups = catalog.filter((g) => g.services.length > 0)
  const visible = activeSpecialty ? groups.filter((g) => g.slug === activeSpecialty) : groups

  return (
    <>
      <StepHeading title="What do you need help with?" description="Choose a specialty, then the type of visit." />
      <nav aria-label="Specialties" className="mb-6 flex flex-wrap gap-2">
        <Link
          href={bookingHref(params, { specialty: null })}
          scroll={false}
          aria-current={!activeSpecialty ? "true" : undefined}
          className={cn(
            "rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent",
            !activeSpecialty && "border-primary bg-primary text-primary-foreground hover:bg-primary"
          )}
        >
          All
        </Link>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={bookingHref(params, { specialty: g.slug })}
            scroll={false}
            aria-current={activeSpecialty === g.slug ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent",
              activeSpecialty === g.slug && "border-primary bg-primary text-primary-foreground hover:bg-primary"
            )}
          >
            <SpecialtyIcon name={g.icon} className="size-4" />
            {g.name}
          </Link>
        ))}
      </nav>
      <div className="grid gap-8">
        {visible.map((g) => (
          <section key={g.id} aria-labelledby={`svc-${g.slug}`} className="grid gap-3">
            <h3 id={`svc-${g.slug}`} className="text-lg font-semibold">
              {g.name}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {g.services.map((svc) => (
                <li key={svc.id}>
                  <OptionCard
                    href={bookingHref(params, { specialty: g.slug, service: svc.slug })}
                    selected={service?.id === svc.id}
                    className="h-full items-start"
                  >
                    <div className="grid gap-1">
                      <span className="font-semibold">{svc.name}</span>
                      <span className="line-clamp-2 text-sm text-muted-foreground">{svc.description}</span>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatDuration(svc.durationMinutes)} · {formatPrice(svc.priceCents)}
                      </span>
                    </div>
                  </OptionCard>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

/* ----------------------------------------------------------------- Doctor */

export function DoctorStep({ state, params }: StepProps) {
  const { doctorOptions, service } = state
  if (!doctorOptions.length) {
    return (
      <EmptyState
        title="No doctors offer this service right now"
        description="Please choose a different service, or call any clinic and we'll help you find an appointment."
        action={
          <Button asChild variant="outline">
            <Link href={bookingHref(params, { service: null, step: "service" })}>Choose another service</Link>
          </Button>
        }
      />
    )
  }
  return (
    <>
      <StepHeading title="Choose your doctor" description={`Doctors who offer ${service?.name.toLowerCase()}.`} />
      <ul className="grid gap-3">
        {doctorOptions.map(({ doctor, next }) => {
          const nextClinic = next && doctor.clinics.find((c) => c.id === next.clinicId)
          return (
            <li key={doctor.id}>
              <OptionCard href={bookingHref(params, { doctor: doctor.slug })} selected={state.doctor?.id === doctor.id}>
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-mint">
                  {doctor.photoUrl && (
                    <Image src={doctor.photoUrl} alt="" fill sizes="64px" className="object-cover object-top" />
                  )}
                </div>
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-semibold">{doctor.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {doctor.title} · {doctor.clinics.map((c) => c.city).join(" · ")}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {next && nextClinic
                      ? `Next available ${formatInZone(next.startsAt, nextClinic.timezone, "EEE, MMM d 'at' h:mm a")} ${TIMEZONE_ABBR[nextClinic.timezone] ?? ""}`
                      : "No online availability in the next 3 weeks"}
                  </span>
                </div>
              </OptionCard>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* ------------------------------------------------------- Clinic and type */

export function ClinicStep({ state, params }: StepProps) {
  const { doctor, clinic, type } = state
  if (!doctor) return null
  return (
    <>
      <StepHeading title="Where would you like to be seen?" />
      <div className="grid gap-8">
        <section aria-labelledby="clinic-choice" className="grid gap-3">
          <h3 id="clinic-choice" className="font-semibold">
            Clinic
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {doctor.clinics.map((c) => (
              <li key={c.id}>
                <OptionCard
                  href={bookingHref(params, { clinic: c.slug, type: type })}
                  selected={clinic?.id === c.id}
                  className="h-full"
                >
                  <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="grid">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-sm text-muted-foreground">{c.city}</span>
                  </span>
                </OptionCard>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="type-choice" className="grid gap-3">
          <h3 id="type-choice" className="font-semibold">
            Visit type
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {doctor.consultationTypes.map((t: ConsultationType) => (
              <li key={t}>
                <OptionCard
                  href={bookingHref(params, { clinic: clinic?.slug ?? params.clinic, type: t })}
                  selected={type === t}
                  className="h-full"
                >
                  {t === "video" ? (
                    <Video className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <span className="grid">
                    <span className="font-semibold">{CONSULTATION_LABELS[t]}</span>
                    <span className="text-sm text-muted-foreground">
                      {t === "video" ? "We'll email you a secure link" : "Visit the clinic in person"}
                    </span>
                  </span>
                </OptionCard>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------- Time */

export function TimeStep({ state, params }: StepProps) {
  const { clinic, availableDates, date, slotsForDate, slot, slotGone } = state
  if (!clinic) return null
  const tz = TIMEZONE_ABBR[clinic.timezone] ?? ""

  if (!availableDates.length) {
    return (
      <EmptyState
        title="No online availability in the next 60 days"
        description={
          <>Please call {clinic.name} and our reception team will find you a time, or choose another doctor.</>
        }
        action={
          <Button asChild variant="outline">
            <Link href={bookingHref(params, { doctor: null, step: "doctor" })}>Choose another doctor</Link>
          </Button>
        }
      />
    )
  }

  const hrefForDate = Object.fromEntries(availableDates.map((d) => [d, bookingHref(params, { date: d })]))
  const parts = [
    {
      label: "Morning",
      slots: slotsForDate.filter((s) => Number(formatInZone(s.startsAt, clinic.timezone, "H")) < 12),
    },
    {
      label: "Afternoon",
      slots: slotsForDate.filter((s) => Number(formatInZone(s.startsAt, clinic.timezone, "H")) >= 12),
    },
  ].filter((p) => p.slots.length)

  return (
    <>
      <StepHeading title="Pick a date and time" description={`Times are shown in clinic time (${tz}).`} />
      {slotGone && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>That time is no longer available</AlertTitle>
          <AlertDescription>Someone booked it a moment ago. Please choose another time below.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <BookingDatePicker availableDates={availableDates} selected={date} hrefForDate={hrefForDate} />
        <div className="grid content-start gap-5">
          {date && (
            <h3 className="font-semibold">
              {formatInZone(slotsForDate[0]?.startsAt ?? new Date(), clinic.timezone, "EEEE, MMMM d")}
            </h3>
          )}
          {parts.map((part) => (
            <section key={part.label} aria-label={part.label} className="grid gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">{part.label}</h4>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {part.slots.map((s) => {
                  const iso = s.startsAt.toISOString()
                  const selected = slot?.startsAt.getTime() === s.startsAt.getTime()
                  return (
                    <li key={iso}>
                      <Link
                        href={bookingHref(params, { date, slot: iso })}
                        scroll={false}
                        aria-current={selected ? "true" : undefined}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-xl border bg-card text-sm font-semibold text-teal-900 transition hover:border-primary hover:bg-accent",
                          selected && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                        )}
                      >
                        {formatInZone(s.startsAt, clinic.timezone, "h:mm a")}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- Details */

export function DetailsStep({ state, params, user }: StepProps & { user: CurrentUser | null }) {
  if (!user) {
    return (
      <>
        <StepHeading
          title="Create an account or sign in"
          description="So you can manage this appointment, get reminders and see your visit history."
        />
        <div className="max-w-lg">
          <BookingAuthPanel />
        </div>
      </>
    )
  }
  if (user.role !== "patient") {
    return (
      <Alert>
        <AlertTitle>You&apos;re signed in as staff</AlertTitle>
        <AlertDescription>
          Online booking is for patients. To book on someone&apos;s behalf, use the{" "}
          <Link href="/staff/reception" className="font-medium underline">
            reception dashboard
          </Link>
          .
        </AlertDescription>
      </Alert>
    )
  }
  const p = state.patient
  const [first, ...rest] = user.name.split(" ")
  return (
    <>
      <StepHeading title="Your details" description="We'll save these to your account for next time." />
      <PatientDetailsForm
        defaultValues={{
          firstName: p?.firstName ?? first ?? "",
          lastName: p?.lastName ?? rest.join(" "),
          dateOfBirth: p?.dateOfBirth ?? "",
          phone: p?.phone ?? "",
        }}
        continueHref={bookingHref(params, { step: "review" })}
      />
    </>
  )
}

/* ----------------------------------------------------------------- Review */

export function ReviewStep({ state, params }: StepProps) {
  const { service, doctor, clinic, type, slot, patient } = state
  if (!service || !doctor || !clinic || !type || !slot || !patient) return null
  return (
    <>
      <StepHeading title="Review and confirm" description="Check everything looks right, then confirm your booking." />
      <dl className="mb-6 grid gap-x-6 gap-y-3 rounded-2xl bg-muted/60 p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Patient</dt>
          <dd className="font-medium">
            {patient.firstName} {patient.lastName}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Contact number</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <Phone className="size-3.5" aria-hidden="true" />
            {patient.phone}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Appointment</dt>
          <dd className="font-medium">
            {service.name} with {doctor.name}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">When</dt>
          <dd className="font-medium">
            {formatInZone(slot.startsAt, clinic.timezone, "EEE, MMM d 'at' h:mm a")}{" "}
            {TIMEZONE_ABBR[clinic.timezone] ?? ""}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">Where</dt>
          <dd className="font-medium">
            {type === "video" ? "Video call · " : ""}
            {clinic.name}, {clinic.city}
          </dd>
        </div>
      </dl>
      <ConfirmBooking
        booking={{
          doctorId: doctor.id,
          clinicId: clinic.id,
          serviceId: service.id,
          consultationType: type,
          startsAt: slot.startsAt.toISOString(),
        }}
        timezone={clinic.timezone}
        alternativeHref={bookingHref(params, { date: null, slot: null })}
        detailsHref={bookingHref(params, { step: "details" })}
      />
    </>
  )
}
