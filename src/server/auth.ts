import "server-only"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { forbidden, redirect } from "next/navigation"
import { cache } from "react"
import { db } from "@/db"
import { doctorClinics, doctors, staffClinics } from "@/db/schema"
import { isRole, STAFF_ROLES, type Role } from "@/lib/domain"
import { auth } from "./better-auth"

/**
 * Data-access-layer auth helpers. These are the real security boundary:
 * proxy.ts and layouts only gate navigation, while every query and server
 * action calls one of these before touching data.
 */

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: Role
}

/** The raw Better Auth session, memoised per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/** The signed-in user, or null. A user row with an unknown role is treated as signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession()
  if (!session) return null
  const { id, name, email, role } = session.user
  if (!isRole(role)) return null
  return { id, name, email, role }
})

/** Requires a signed-in user; otherwise sends them to sign in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return user
}

/** Requires one of the given roles; signed-in users with another role get a 403. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) forbidden()
  return user
}

/** Clinic scope: "all" for admins, otherwise the clinic ids the user works at. */
export type ClinicScope = "all" | string[]

export const getClinicScope = cache(async (user: CurrentUser): Promise<ClinicScope> => {
  switch (user.role) {
    case "admin":
      return "all"
    case "receptionist":
    case "manager": {
      const rows = await db
        .select({ clinicId: staffClinics.clinicId })
        .from(staffClinics)
        .where(eq(staffClinics.userId, user.id))
      return rows.map((r) => r.clinicId)
    }
    case "doctor": {
      const rows = await db
        .select({ clinicId: doctorClinics.clinicId })
        .from(doctorClinics)
        .innerJoin(doctors, eq(doctors.id, doctorClinics.doctorId))
        .where(eq(doctors.userId, user.id))
      return rows.map((r) => r.clinicId)
    }
    case "patient":
      return []
  }
})

export function scopeIncludes(scope: ClinicScope, clinicId: string): boolean {
  return scope === "all" || scope.includes(clinicId)
}

/** Requires a staff role with access to the given clinic. */
export async function requireClinicAccess(clinicId: string, ...roles: Role[]): Promise<CurrentUser> {
  const user = await requireRole(...(roles.length ? roles : STAFF_ROLES))
  const scope = await getClinicScope(user)
  if (!scopeIncludes(scope, clinicId)) forbidden()
  return user
}

/** The doctor profile id linked to a doctor user, or null if none is linked. */
export const getDoctorIdForUser = cache(async (userId: string): Promise<string | null> => {
  const [row] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.userId, userId)).limit(1)
  return row?.id ?? null
})
