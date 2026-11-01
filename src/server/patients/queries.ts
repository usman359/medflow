import "server-only"
import { eq } from "drizzle-orm"
import { cache } from "react"
import { db } from "@/db"
import { patients } from "@/db/schema"
import type { PatientDetailsInput } from "@/lib/validation/booking"

/** The patient record linked to a signed-in user, if they have completed one. */
export const getPatientForUser = cache(async (userId: string) => {
  const [row] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1)
  return row ?? null
})

export function isPatientProfileComplete(p: typeof patients.$inferSelect | null): boolean {
  return Boolean(p && p.firstName && p.lastName && p.phone && p.dateOfBirth)
}

/**
 * Creates or updates the signed-in user's own patient record. Never matches on
 * email: a reception-created record is only linked to an account by staff, so
 * nobody can claim someone else's history by signing up with their address.
 */
export async function upsertPatientForUser(userId: string, email: string, details: PatientDetailsInput) {
  const values = { ...details, email, updatedAt: new Date() }
  const [row] = await db
    .insert(patients)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: patients.userId, set: values })
    .returning()
  return row
}
