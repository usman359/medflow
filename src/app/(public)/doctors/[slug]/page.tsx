import { ArrowLeft, CalendarX2, Clock, Languages, MapPin, Video } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DoctorPortrait } from "@/components/doctors/doctor-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CONSULTATION_LABELS } from "@/lib/domain"
import { formatDuration, formatInZone, formatPrice, TIMEZONE_ABBR } from "@/lib/format"
import { getNextAvailableSlots } from "@/server/availability/queries"
import { getDoctorBySlug } from "@/server/catalog/queries"

export async function generateMetadata({ params }: PageProps<"/doctors/[slug]">): Promise<Metadata> {
  const doctor = await getDoctorBySlug((await params).slug)
  if (!doctor) return { title: "Doctor not found" }
  return { title: `${doctor.name}, ${doctor.title}`, description: doctor.bio.slice(0, 155) }
}

export default async function DoctorProfilePage({ params }: PageProps<"/doctors/[slug]">) {
  const doctor = await getDoctorBySlug((await params).slug)
  if (!doctor) notFound()

  const slots = await getNextAvailableSlots(doctor.id, 8)
  const clinicById = new Map(doctor.clinics.map((c) => [c.id, c]))

  // Group the next slots by clinic-local day for a compact, scannable list.
  const days: {
    key: string
    label: string
    slots: { iso: string; time: string; clinicSlug: string; clinic: string }[]
  }[] = []
  for (const slot of slots) {
    const clinic = clinicById.get(slot.clinicId)
    if (!clinic) continue
    const key = formatInZone(slot.startsAt, clinic.timezone, "yyyy-MM-dd")
    let day = days.find((d) => d.key === key)
    if (!day) {
      day = { key, label: formatInZone(slot.startsAt, clinic.timezone, "EEEE, MMM d"), slots: [] }
      days.push(day)
    }
    day.slots.push({
      iso: slot.startsAt.toISOString(),
      time: `${formatInZone(slot.startsAt, clinic.timezone, "h:mm a")} ${TIMEZONE_ABBR[clinic.timezone] ?? ""}`.trim(),
      clinicSlug: clinic.slug,
      clinic: clinic.name.replace(/^MedFlow\s+/, ""),
    })
  }

  return (
    <div className="container-page grid gap-8 py-8 md:py-12">
      <Button asChild variant="ghost" className="-ml-3 w-fit">
        <Link href="/doctors">
          <ArrowLeft aria-hidden="true" /> All doctors
        </Link>
      </Button>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <div className="mx-auto w-full max-w-xs lg:max-w-none">
          <DoctorPortrait doctor={doctor} sizes="(min-width: 1024px) 20rem, 80vw" priority />
        </div>

        <div className="grid content-start gap-6">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {doctor.specialties.map((s) => (
                <Badge key={s.slug} variant="secondary" asChild>
                  <Link href={`/doctors?specialty=${s.slug}`}>{s.name}</Link>
                </Badge>
              ))}
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">{doctor.name}</h1>
            <p className="text-lg text-muted-foreground">
              {doctor.title} · {doctor.yearsExperience} years of experience
            </p>
          </div>
          <p className="max-w-prose text-foreground/90">{doctor.bio}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <dl>
                <dt className="font-medium">Clinics</dt>
                <dd className="text-muted-foreground">
                  {doctor.clinics.map((c) => (
                    <span key={c.id} className="block">
                      {c.name} · {c.city}
                    </span>
                  ))}
                </dd>
              </dl>
            </div>
            <div className="flex gap-3">
              <Video className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <dl>
                <dt className="font-medium">Visit types</dt>
                <dd className="text-muted-foreground">
                  {doctor.consultationTypes.map((t) => CONSULTATION_LABELS[t]).join(" · ")}
                </dd>
              </dl>
            </div>
            <div className="flex gap-3">
              <Languages className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <dl>
                <dt className="font-medium">Languages</dt>
                <dd className="text-muted-foreground">{doctor.languages.join(", ")}</dd>
              </dl>
            </div>
          </div>

          {doctor.services.length > 0 && (
            <section aria-labelledby="services-title" className="grid gap-3">
              <h2 id="services-title" className="text-xl font-semibold">
                Services
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {doctor.services.map((svc) => (
                  <li key={svc.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatDuration(svc.durationMinutes)} · {formatPrice(svc.priceCents)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/book?doctor=${doctor.slug}&service=${svc.slug}`}>
                        Book<span className="sr-only"> {svc.name}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="availability-title" className="lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-4 rounded-3xl border bg-card p-5 shadow-sm">
            <h2 id="availability-title" className="text-xl font-semibold">
              Next available
            </h2>
            {days.length ? (
              <div className="grid gap-4">
                {days.map((day) => (
                  <div key={day.key} className="grid gap-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{day.label}</h3>
                    <ul className="grid grid-cols-2 gap-2">
                      {day.slots.map((slot) => (
                        <li key={slot.iso + slot.clinicSlug}>
                          <Link
                            href={`/book?doctor=${doctor.slug}&clinic=${slot.clinicSlug}&slot=${encodeURIComponent(slot.iso)}`}
                            className="flex flex-col rounded-xl border bg-background px-3 py-2 text-center transition hover:border-primary hover:bg-accent"
                          >
                            <span className="font-semibold text-teal-900">{slot.time}</span>
                            {doctor.clinics.length > 1 && (
                              <span className="text-xs text-muted-foreground">{slot.clinic}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-start gap-2 text-muted-foreground">
                <CalendarX2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                No online availability in the next three weeks. Please call the clinic and we&apos;ll find you a time.
              </p>
            )}
            <Button asChild size="lg">
              <Link href={`/book?doctor=${doctor.slug}`}>See all times</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
