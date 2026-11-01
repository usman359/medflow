import "server-only"
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { cache } from "react"
import { db } from "@/db"
import { clinics, doctorClinics, doctors, doctorServices, doctorSpecialties, services, specialties } from "@/db/schema"
import type { ConsultationType } from "@/lib/domain"

/** Public catalog reads. No auth: everything here is shown to anonymous visitors. */

export type SpecialtySummary = {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  doctorCount: number
}

export const getSpecialties = cache(async (): Promise<SpecialtySummary[]> => {
  return db
    .select({
      id: specialties.id,
      slug: specialties.slug,
      name: specialties.name,
      description: specialties.description,
      icon: specialties.icon,
      doctorCount: count(doctors.id),
    })
    .from(specialties)
    .leftJoin(doctorSpecialties, eq(doctorSpecialties.specialtyId, specialties.id))
    .leftJoin(doctors, and(eq(doctors.id, doctorSpecialties.doctorId), eq(doctors.isActive, true)))
    .groupBy(specialties.id)
    .orderBy(asc(specialties.name))
})

export const getClinics = cache(async () => {
  return db.query.clinics.findMany({ where: eq(clinics.isActive, true), orderBy: asc(clinics.name) })
})

export type DoctorCardData = {
  id: string
  slug: string
  name: string
  title: string
  bio: string
  photoUrl: string | null
  yearsExperience: number
  languages: string[]
  consultationTypes: ConsultationType[]
  specialties: { slug: string; name: string }[]
  clinics: { id: string; slug: string; name: string; city: string; timezone: string }[]
}

const doctorWith = {
  doctorSpecialties: { with: { specialty: { columns: { slug: true, name: true } } } },
  doctorClinics: {
    with: { clinic: { columns: { id: true, slug: true, name: true, city: true, timezone: true, isActive: true } } },
  },
} as const

type DoctorWithRelations = typeof doctors.$inferSelect & {
  doctorSpecialties: { specialty: { slug: string; name: string } }[]
  doctorClinics: {
    clinic: { id: string; slug: string; name: string; city: string; timezone: string; isActive: boolean }
  }[]
}

function toCard(d: DoctorWithRelations): DoctorCardData {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    title: d.title,
    bio: d.bio,
    photoUrl: d.photoUrl,
    yearsExperience: d.yearsExperience,
    languages: d.languages,
    consultationTypes: d.consultationTypes,
    specialties: d.doctorSpecialties.map((ds) => ds.specialty),
    clinics: d.doctorClinics
      .map((dc) => dc.clinic)
      .filter((c) => c.isActive)
      .map(({ id, slug, name, city, timezone }) => ({ id, slug, name, city, timezone })),
  }
}

export type DoctorFilters = {
  specialty?: string | null
  clinic?: string | null
  type?: ConsultationType | null
  q?: string | null
}

export async function searchDoctors(filters: DoctorFilters = {}): Promise<DoctorCardData[]> {
  const conditions = [eq(doctors.isActive, true)]

  if (filters.specialty) {
    conditions.push(
      inArray(
        doctors.id,
        db
          .select({ id: doctorSpecialties.doctorId })
          .from(doctorSpecialties)
          .innerJoin(specialties, eq(specialties.id, doctorSpecialties.specialtyId))
          .where(eq(specialties.slug, filters.specialty))
      )
    )
  }
  if (filters.clinic) {
    conditions.push(
      inArray(
        doctors.id,
        db
          .select({ id: doctorClinics.doctorId })
          .from(doctorClinics)
          .innerJoin(clinics, eq(clinics.id, doctorClinics.clinicId))
          .where(eq(clinics.slug, filters.clinic))
      )
    )
  }
  if (filters.type) {
    conditions.push(sql`${filters.type}::consultation_type = any(${doctors.consultationTypes})`)
  }
  const q = filters.q?.trim()
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`
    conditions.push(
      or(
        ilike(doctors.name, pattern),
        ilike(doctors.title, pattern),
        inArray(
          doctors.id,
          db
            .select({ id: doctorSpecialties.doctorId })
            .from(doctorSpecialties)
            .innerJoin(specialties, eq(specialties.id, doctorSpecialties.specialtyId))
            .where(ilike(specialties.name, pattern))
        )
      )!
    )
  }

  const rows = await db.query.doctors.findMany({
    where: and(...conditions),
    with: doctorWith,
    orderBy: asc(doctors.name),
  })
  return rows.map(toCard)
}

export const getDoctorBySlug = cache(async (slug: string) => {
  const row = await db.query.doctors.findFirst({
    where: and(eq(doctors.slug, slug), eq(doctors.isActive, true)),
    with: {
      ...doctorWith,
      doctorServices: {
        with: {
          service: {
            columns: { id: true, slug: true, name: true, durationMinutes: true, priceCents: true, isActive: true },
          },
        },
      },
    },
  })
  if (!row) return null
  return {
    ...toCard(row),
    services: row.doctorServices
      .map((ds) => ds.service)
      .filter((svc) => svc.isActive)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
})

export async function countDoctors(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(doctors).where(eq(doctors.isActive, true))
  return row?.n ?? 0
}

export async function getFeaturedDoctors(limit = 4): Promise<DoctorCardData[]> {
  const rows = await db.query.doctors.findMany({
    where: eq(doctors.isActive, true),
    with: doctorWith,
    orderBy: (d, { desc }) => [desc(d.yearsExperience)],
    limit,
  })
  return rows.map(toCard)
}

export const getServicesBySpecialty = cache(async () => {
  return db.query.specialties.findMany({
    orderBy: asc(specialties.name),
    with: {
      services: {
        where: eq(services.isActive, true),
        orderBy: asc(services.name),
      },
    },
  })
})

export const getServiceBySlug = cache(async (slug: string) => {
  const row = await db.query.services.findFirst({
    where: and(eq(services.slug, slug), eq(services.isActive, true)),
    with: { specialty: { columns: { id: true, slug: true, name: true } } },
  })
  return row ?? null
})

export async function getDoctorsForService(serviceId: string): Promise<DoctorCardData[]> {
  const rows = await db.query.doctors.findMany({
    where: and(
      eq(doctors.isActive, true),
      inArray(
        doctors.id,
        db.select({ id: doctorServices.doctorId }).from(doctorServices).where(eq(doctorServices.serviceId, serviceId))
      )
    ),
    with: doctorWith,
    orderBy: asc(doctors.name),
  })
  return rows.map(toCard)
}
