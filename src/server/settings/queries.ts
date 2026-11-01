import "server-only"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  availabilityExceptions,
  availabilityRules,
  clinics,
  doctorClinics,
  doctors,
  doctorServices,
  doctorSpecialties,
  services,
  specialties,
} from "@/db/schema"
import type { ConsultationType } from "@/lib/domain"
import { getClinicScope, type CurrentUser } from "@/server/auth"

/** Clinics this manager/admin may configure, including inactive ones (so they can be re-enabled). */
export async function loadManagedClinics(user: CurrentUser) {
  const scope = await getClinicScope(user)
  if (scope !== "all" && scope.length === 0) return []
  return db
    .select()
    .from(clinics)
    .where(scope === "all" ? undefined : inArray(clinics.id, scope))
    .orderBy(asc(clinics.name))
}

export type ManagedDoctor = {
  id: string
  slug: string
  name: string
  title: string
  bio: string
  photoUrl: string | null
  yearsExperience: number
  languages: string[]
  consultationTypes: ConsultationType[]
  isActive: boolean
  clinicIds: string[]
  specialtyIds: string[]
  serviceIds: string[]
  hasAccount: boolean
}

/** Doctors who work at one of the user's clinics (admins see every doctor, including unassigned ones). */
export async function loadManagedDoctors(user: CurrentUser): Promise<ManagedDoctor[]> {
  const scope = await getClinicScope(user)
  if (scope !== "all" && scope.length === 0) return []

  const visibleIds =
    scope === "all"
      ? null
      : (
          await db
            .selectDistinct({ id: doctorClinics.doctorId })
            .from(doctorClinics)
            .where(inArray(doctorClinics.clinicId, scope))
        ).map((r) => r.id)
  if (visibleIds && visibleIds.length === 0) return []

  const rows = await db
    .select()
    .from(doctors)
    .where(visibleIds ? inArray(doctors.id, visibleIds) : undefined)
    .orderBy(asc(doctors.name))
  if (rows.length === 0) return []
  const ids = rows.map((d) => d.id)

  const [dc, ds, dsv] = await Promise.all([
    db.select().from(doctorClinics).where(inArray(doctorClinics.doctorId, ids)),
    db.select().from(doctorSpecialties).where(inArray(doctorSpecialties.doctorId, ids)),
    db.select().from(doctorServices).where(inArray(doctorServices.doctorId, ids)),
  ])

  return rows.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    title: d.title,
    bio: d.bio,
    photoUrl: d.photoUrl,
    yearsExperience: d.yearsExperience,
    languages: d.languages,
    consultationTypes: d.consultationTypes,
    isActive: d.isActive,
    hasAccount: d.userId !== null,
    clinicIds: dc.filter((x) => x.doctorId === d.id).map((x) => x.clinicId),
    specialtyIds: ds.filter((x) => x.doctorId === d.id).map((x) => x.specialtyId),
    serviceIds: dsv.filter((x) => x.doctorId === d.id).map((x) => x.serviceId),
  }))
}

export async function loadSpecialtiesAndServices() {
  const [sp, sv] = await Promise.all([
    db.select({ id: specialties.id, name: specialties.name }).from(specialties).orderBy(asc(specialties.name)),
    db.select().from(services).orderBy(asc(services.name)),
  ])
  return { specialties: sp, services: sv }
}

/** Weekly rules at the user's clinics and every time-off entry for one doctor. */
export async function loadDoctorAvailability(user: CurrentUser, doctorId: string) {
  const scope = await getClinicScope(user)
  if (scope !== "all" && scope.length === 0) return { rules: [], exceptions: [] }
  const rules = await db
    .select({
      id: availabilityRules.id,
      clinicId: availabilityRules.clinicId,
      clinicName: clinics.name,
      timezone: clinics.timezone,
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
      slotMinutes: availabilityRules.slotMinutes,
      validFrom: availabilityRules.validFrom,
      validTo: availabilityRules.validTo,
    })
    .from(availabilityRules)
    .innerJoin(clinics, eq(clinics.id, availabilityRules.clinicId))
    .where(
      and(
        eq(availabilityRules.doctorId, doctorId),
        scope === "all" ? undefined : inArray(availabilityRules.clinicId, scope)
      )
    )
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime))

  const exceptions = await db
    .select({
      id: availabilityExceptions.id,
      clinicId: availabilityExceptions.clinicId,
      clinicName: clinics.name,
      startsAt: availabilityExceptions.startsAt,
      endsAt: availabilityExceptions.endsAt,
      reason: availabilityExceptions.reason,
    })
    .from(availabilityExceptions)
    .leftJoin(clinics, eq(clinics.id, availabilityExceptions.clinicId))
    .where(eq(availabilityExceptions.doctorId, doctorId))
    .orderBy(asc(availabilityExceptions.startsAt))

  return { rules, exceptions }
}
