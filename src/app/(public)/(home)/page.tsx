import { ArrowRight, CalendarCheck, Clock, MapPin, Phone, Search, ShieldCheck, Stethoscope, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { DoctorCard } from "@/components/doctors/doctor-card"
import { SpecialtyIcon } from "@/components/doctors/specialty-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PHOTOS, unsplash } from "@/lib/photos"
import { countDoctors, getClinics, getFeaturedDoctors, getSpecialties } from "@/server/catalog/queries"

const STEPS = [
  {
    icon: Search,
    title: "Find the right doctor",
    body: "Search by specialty, clinic or name, and read about each doctor before you choose.",
  },
  {
    icon: CalendarCheck,
    title: "Pick a time that suits you",
    body: "See real availability across our clinics, including video visits for many specialties.",
  },
  {
    icon: ShieldCheck,
    title: "Confirm in a minute",
    body: "Add a few details and you're booked. Manage or cancel any time from your account.",
  },
]

export default async function HomePage() {
  const [specialties, clinics, featured, doctorCount] = await Promise.all([
    getSpecialties(),
    getClinics(),
    getFeaturedDoctors(4),
    countDoctors(),
  ])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-b from-mint/70 via-background to-background">
        <div className="container-page grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="grid gap-6">
            <p className="eyebrow">Care across Boston, New York & Chicago</p>
            <h1 className="text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
              See the right doctor, <span className="text-primary">without the phone queue.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Book in-person or video appointments with MedFlow specialists in a few taps. Real availability, instant
              confirmation and reminders before your visit.
            </p>
            <form
              action="/doctors"
              role="search"
              className="grid gap-2 rounded-2xl border bg-card p-2 shadow-sm sm:grid-cols-[1fr_auto]"
            >
              <label htmlFor="hero-q" className="sr-only">
                Search by specialty, condition or doctor name
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="hero-q"
                  name="q"
                  placeholder="Try “dermatology” or “Dr. Khan”"
                  className="h-12 border-0 pl-11 text-base shadow-none focus-visible:ring-0"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6">
                Find a doctor
              </Button>
            </form>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-primary" aria-hidden="true" /> Same-week appointments
              </li>
              <li className="flex items-center gap-2">
                <Video className="size-4 text-primary" aria-hidden="true" /> Video visits
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" aria-hidden="true" /> {clinics.length} clinics
              </li>
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-4/5 overflow-hidden rounded-4xl shadow-xl sm:aspect-square">
              <Image
                src={unsplash(PHOTOS.heroConsultation, 1200)}
                alt="A MedFlow doctor talking with a smiling patient"
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg sm:-left-6">
              <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </span>
              <span className="grid text-sm leading-tight">
                <span className="font-semibold text-teal-900">Booking confirmed</span>
                <span className="text-muted-foreground">Thu · 9:30 AM with Dr. Morales</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section aria-labelledby="specialties-title" className="container-page py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <p className="eyebrow">Specialties</p>
            <h2 id="specialties-title" className="text-3xl font-semibold sm:text-4xl">
              What can we help with?
            </h2>
          </div>
          <Button asChild variant="link" className="px-0">
            <Link href="/services">
              See all services & prices <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {specialties.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/doctors?specialty=${s.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition hover:border-primary/40 hover:shadow-md"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <SpecialtyIcon name={s.icon} className="size-5" />
                </span>
                <span className="font-semibold text-teal-900">{s.name}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{s.description}</span>
                <span className="mt-auto text-sm font-medium text-primary">
                  {s.doctorCount} {s.doctorCount === 1 ? "doctor" : "doctors"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="scroll-mt-20 bg-teal-900 text-primary-foreground"
      >
        <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1.6fr]">
          <div className="grid content-start gap-3">
            <p className="text-sm font-semibold tracking-wide text-mint uppercase">How booking works</p>
            <h2 id="how-title" className="text-3xl font-semibold text-primary-foreground sm:text-4xl">
              Three steps, about two minutes.
            </h2>
            <p className="text-primary-foreground/80">
              Prefer to talk to someone? Call any clinic and our reception team will book for you.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-3 w-fit">
              <Link href="/book">Start booking</Link>
            </Button>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid content-start gap-3 rounded-2xl bg-white/7 p-6 ring-1 ring-white/10">
                <span className="flex items-center justify-between">
                  <step.icon className="size-6 text-mint" aria-hidden="true" />
                  <span className="text-sm font-semibold text-primary-foreground/60">0{i + 1}</span>
                </span>
                <h3 className="text-lg font-semibold text-primary-foreground">{step.title}</h3>
                <p className="text-sm text-primary-foreground/80">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured doctors */}
      {featured.length > 0 && (
        <section aria-labelledby="doctors-title" className="container-page py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-2">
              <p className="eyebrow">Our doctors</p>
              <h2 id="doctors-title" className="text-3xl font-semibold sm:text-4xl">
                Experienced, unhurried, on your side.
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/doctors">
                Browse all doctors <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        </section>
      )}

      {/* Locations */}
      <section id="locations" aria-labelledby="locations-title" className="scroll-mt-20 bg-sand/60">
        <div className="container-page py-16 md:py-24">
          <div className="grid gap-2">
            <p className="eyebrow">Locations</p>
            <h2 id="locations-title" className="text-3xl font-semibold sm:text-4xl">
              Visit us in {clinics.length} cities
            </h2>
          </div>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {clinics.map((c) => (
              <li key={c.id} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                <div className="relative aspect-16/10 bg-mint">
                  {c.photoUrl && (
                    <Image
                      src={c.photoUrl}
                      alt={`${c.name} clinic`}
                      fill
                      sizes="(min-width: 768px) 30vw, 92vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="grid gap-3 p-5">
                  <div>
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.addressLine}, {c.city}
                    </p>
                  </div>
                  <ul className="grid gap-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Phone className="size-4 text-primary" aria-hidden="true" />
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                        {c.phone}
                      </a>
                    </li>
                    {c.openingHours && (
                      <li className="flex items-center gap-2">
                        <Clock className="size-4 text-primary" aria-hidden="true" />
                        {c.openingHours}
                      </li>
                    )}
                  </ul>
                  <Button asChild variant="outline" className="mt-1">
                    <Link href={`/doctors?clinic=${c.slug}`}>Doctors at this clinic</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust-title" className="container-page py-16 md:py-24">
        <div className="grid items-center gap-8 rounded-4xl bg-coral-soft p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-3">
            <h2 id="trust-title" className="text-3xl font-semibold">
              Your health information stays private.
            </h2>
            <p className="text-foreground/80">
              Only you and the clinicians caring for you can see your appointments and visit notes. Staff access is
              limited to their own clinics, and every change to an appointment is recorded.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { label: "Doctors", value: doctorCount },
              { label: "Specialties", value: specialties.length },
              { label: "Clinics", value: clinics.length },
              { label: "Online booking", value: "24/7" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-card p-4 text-center shadow-sm">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="text-2xl font-semibold text-teal-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <Stethoscope className="size-8 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold sm:text-3xl">Ready when you are.</h2>
          <Button asChild size="lg">
            <Link href="/book">Book an appointment</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
