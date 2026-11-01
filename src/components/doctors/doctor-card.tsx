import { MapPin, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { DoctorCardData } from "@/server/catalog/queries"

export function DoctorPortrait({
  doctor,
  sizes,
  priority,
}: {
  doctor: Pick<DoctorCardData, "name" | "photoUrl">
  sizes: string
  priority?: boolean
}) {
  return (
    <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-mint">
      {doctor.photoUrl ? (
        <Image
          src={doctor.photoUrl}
          alt={`Portrait of ${doctor.name}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-top"
        />
      ) : null}
    </div>
  )
}

export function DoctorCard({ doctor, priority }: { doctor: DoctorCardData; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-3xl border bg-card p-3 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <DoctorPortrait
        doctor={doctor}
        sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 92vw"
        priority={priority}
      />
      <div className="grid gap-2 px-2 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {doctor.specialties.map((s) => (
            <Badge key={s.slug} variant="secondary">
              {s.name}
            </Badge>
          ))}
        </div>
        <h3 className="text-lg leading-snug font-semibold">
          <Link href={`/doctors/${doctor.slug}`} className="outline-none after:absolute after:inset-0">
            {doctor.name}
          </Link>
        </h3>
        <p className="-mt-1 text-sm text-muted-foreground">
          {doctor.title} · {doctor.yearsExperience} years
        </p>
        <ul className="grid gap-1 text-sm text-muted-foreground">
          <li className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {doctor.clinics.map((c) => c.city).join(" · ")}
          </li>
          {doctor.consultationTypes.includes("video") && (
            <li className="flex items-center gap-1.5">
              <Video className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Video visits available
            </li>
          )}
        </ul>
      </div>
    </article>
  )
}
