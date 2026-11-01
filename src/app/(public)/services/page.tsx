import { Clock } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { SpecialtyIcon } from "@/components/doctors/specialty-icon"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { getServicesBySpecialty } from "@/server/catalog/queries"

export const metadata: Metadata = {
  title: "Services & prices",
  description: "Every MedFlow service, grouped by specialty, with typical durations and self-pay prices.",
}

export default async function ServicesPage() {
  const groups = (await getServicesBySpecialty()).filter((g) => g.services.length > 0)

  return (
    <div className="container-page grid gap-10 py-10 md:py-14">
      <header className="grid gap-2">
        <p className="eyebrow">Services & prices</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">What we offer</h1>
        <p className="max-w-2xl text-muted-foreground">
          Self-pay prices are shown below. Choose a service to see which doctors offer it and when they&apos;re free.
        </p>
      </header>

      <nav aria-label="Specialties" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#${g.slug}`}
            className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:bg-accent"
          >
            {g.name}
          </a>
        ))}
      </nav>

      <div className="grid gap-10">
        {groups.map((g) => (
          <section key={g.id} id={g.slug} aria-labelledby={`${g.slug}-title`} className="grid scroll-mt-24 gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <SpecialtyIcon name={g.icon} className="size-5" />
              </span>
              <div>
                <h2 id={`${g.slug}-title`} className="text-2xl font-semibold">
                  {g.name}
                </h2>
                <p className="text-muted-foreground">{g.description}</p>
              </div>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {g.services.map((svc) => (
                <li
                  key={svc.id}
                  className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center"
                >
                  <div className="grid flex-1 gap-1">
                    <h3 className="font-semibold">{svc.name}</h3>
                    <p className="text-sm text-muted-foreground">{svc.description}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {formatDuration(svc.durationMinutes)}
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-900">{formatPrice(svc.priceCents)}</span>
                    </p>
                  </div>
                  <Button asChild variant="outline" className="shrink-0">
                    <Link href={`/book?service=${svc.slug}`}>
                      Book<span className="sr-only"> {svc.name}</span>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
