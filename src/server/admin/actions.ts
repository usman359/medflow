"use server"

import { hashPassword } from "better-auth/crypto"
import { and, eq, inArray, ne } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { db, type DbOrTx } from "@/db"
import { account, clinics, doctors, session, staffClinics, user } from "@/db/schema"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { isRole, type Role } from "@/lib/domain"
import { newStaffSchema, resetPasswordSchema, updateAccessSchema } from "@/lib/validation/admin"
import { recordAudit } from "@/server/audit"
import { requireRole } from "@/server/auth"
import { countAdmins } from "./queries"

const done = () => revalidatePath("/admin")

/** Read-only checks that the clinics and doctor profile a role needs actually exist and are free to use. */
async function validateAccess(
  userId: string | null,
  role: Role,
  clinicIds: string[],
  doctorId: string | null
): Promise<string | null> {
  if ((role === "receptionist" || role === "manager") && clinicIds.length) {
    const found = await db.select({ id: clinics.id }).from(clinics).where(inArray(clinics.id, clinicIds))
    if (found.length !== clinicIds.length) return "One of the selected clinics no longer exists."
  }
  if (role === "doctor" && doctorId) {
    const [profile] = await db.select({ userId: doctors.userId }).from(doctors).where(eq(doctors.id, doctorId))
    if (!profile) return "That doctor profile no longer exists."
    if (profile.userId && profile.userId !== userId) return "That doctor profile already belongs to another login."
  }
  return null
}

/** Role-specific side tables: which clinics a staff member works at, and which doctor profile a login owns. */
async function applyAccess(tx: DbOrTx, userId: string, role: Role, clinicIds: string[], doctorId: string | null) {
  // Clinic scope only exists for reception and managers; admins see everything, doctors take theirs from the profile.
  await tx.delete(staffClinics).where(eq(staffClinics.userId, userId))
  if ((role === "receptionist" || role === "manager") && clinicIds.length) {
    await tx.insert(staffClinics).values(clinicIds.map((clinicId) => ({ userId, clinicId })))
  }
  // A login owns at most one doctor profile, and only with the doctor role.
  await tx.update(doctors).set({ userId: null }).where(eq(doctors.userId, userId))
  if (role === "doctor" && doctorId) await tx.update(doctors).set({ userId }).where(eq(doctors.id, doctorId))
}

function accessProblem(role: Role, clinicIds: string[], doctorId: string | null): string | null {
  if ((role === "receptionist" || role === "manager") && clinicIds.length === 0) {
    return "Choose at least one clinic. Without one they would see nothing."
  }
  if (role === "doctor" && !doctorId) return "Choose which doctor profile this login belongs to."
  return null
}

export async function updateUserAccessAction(input: unknown): Promise<ActionResult> {
  const admin = await requireRole("admin")
  const parsed = updateAccessSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { userId, role, clinicIds, doctorId } = parsed.data

  const [target] = await db
    .select({ id: user.id, role: user.role, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
  if (!target) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that user." }
  const before = isRole(target.role) ? target.role : "patient"

  // Lock-out protection: you can't demote yourself, and the group must always keep an admin.
  if (before === "admin" && role !== "admin") {
    if (target.id === admin.id)
      return {
        ok: false,
        code: "NOT_ALLOWED",
        error: "You can't remove your own admin access. Ask another administrator.",
      }
    if ((await countAdmins()) <= 1)
      return { ok: false, code: "NOT_ALLOWED", error: "At least one system administrator is required." }
  }
  const problem = accessProblem(role, clinicIds, doctorId) ?? (await validateAccess(userId, role, clinicIds, doctorId))
  if (problem) return { ok: false, error: problem }

  await db.transaction(async (tx) => {
    await applyAccess(tx, userId, role, clinicIds, doctorId)
    await tx.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId))
    await recordAudit(tx, {
      actor: { id: admin.id, role: admin.role },
      entityType: "user",
      entityId: userId,
      action: before === role ? "access_updated" : "role_changed",
      fromStatus: before,
      toStatus: role,
      metadata: { email: target.email, clinicCount: clinicIds.length },
    })
  })
  done()
  return { ok: true, data: undefined }
}

export async function createStaffUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await requireRole("admin")
  const parsed = newStaffSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { name, email, password, role, clinicIds, doctorId } = parsed.data

  const problem = accessProblem(role, clinicIds, doctorId) ?? (await validateAccess(null, role, clinicIds, doctorId))
  if (problem) return { ok: false, error: problem }
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
  if (existing)
    return {
      ok: false,
      fieldErrors: { email: ["An account with this email already exists."] },
      error: "That email is already in use.",
    }

  // Created directly (not via the public sign-up) so the administrator isn't signed in as the new person.
  const passwordHash = await hashPassword(password)
  const userId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id: userId, name, email, role, emailVerified: true })
    await tx
      .insert(account)
      .values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash })
    await applyAccess(tx, userId, role, clinicIds, doctorId)
    await recordAudit(tx, {
      actor: { id: admin.id, role: admin.role },
      entityType: "user",
      entityId: userId,
      action: "created",
      toStatus: role,
      metadata: { email },
    })
  })
  done()
  return { ok: true, data: { id: userId } }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const admin = await requireRole("admin")
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { userId, password } = parsed.data

  const [target] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId))
  if (!target) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that user." }

  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .returning({ id: account.id })
    if (updated.length === 0) {
      await tx
        .insert(account)
        .values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash })
    }
    // Sign the person out everywhere, except the administrator doing the reset on their own account.
    await tx
      .delete(session)
      .where(and(eq(session.userId, userId), userId === admin.id ? ne(session.userId, userId) : undefined))
    await recordAudit(tx, {
      actor: { id: admin.id, role: admin.role },
      entityType: "user",
      entityId: userId,
      action: "password_reset",
      metadata: { email: target.email },
    })
  })
  done()
  return { ok: true, data: undefined }
}
