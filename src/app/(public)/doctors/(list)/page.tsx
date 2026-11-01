import type { Metadata } from "next"
import Link from "next/link"
import { DoctorCard } from "@/components/doctors/doctor-card"
import { DoctorFilters } from "@/components/doctors/doctor-filters"
import { EmptyState } from "@/components/illustrations/empty-state"
import { Button } from "@/components/ui/button"
import { loadDoctorSearchParams } from "@/lib/search-params/doctors"
import { getClinics, getSpecialties, searchDoctors } from "@/server/catalog/queries"

export const metadata: Metadata = {
  title: "Find a doctor",
  description: "Browse MedFlow doctors by specialty, clinic and visit type, then book online.",
}

export default async function DoctorsPage({ searchParams }: PageProps<"/doctors">) {
  const filters = await loadDoctorSearchParams(searchParams)
  const [doctors, specialties, clinics] = await Promise.all([searchDoctors(filters), getSpecialties(), getClinics()])
  const specialtyName = specialties.find((s) => s.slug === filters.specialty)?.name

  return (
    <div className="container-page grid gap-8 py-10 md:py-14">
      <header className="grid gap-2">
        <p className="eyebrow">Our doctors</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {specialtyName ? `${specialtyName} doctors` : "Find a doctor"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every doctor here takes online bookings. Choose one to see their availability, or{" "}
          <Link href="/book" className="font-medium text-primary underline-offset-4 hover:underline">
            start booking by specialty
          </Link>
          .
        </p>
      </header>

      <DoctorFilters
        specialties={specialties.map(({ slug, name }) => ({ slug, name }))}
        clinics={clinics.map(({ slug, name, city }) => ({ slug, name, city }))}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {doctors.length === 1 ? "1 doctor" : `${doctors.length} doctors`} found
      </p>

      {doctors.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {doctors.map((d, i) => (
            <DoctorCard key={d.id} doctor={d} priority={i < 4} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No doctors match those filters"
          description="Try a different specialty or clinic, or clear the filters to see everyone."
          action={
            <Button asChild variant="outline">
              <Link href="/doctors">Clear filters</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
