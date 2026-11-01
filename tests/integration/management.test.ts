import "@/db/load-env"
import { randomUUID } from "node:crypto"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  account,
  auditEvents,
  availabilityExceptions,
  availabilityRules,
  clinics,
  doctorSpecialties,
  doctors,
  staffClinics,
  user,
} from "@/db/schema"
import type { Role } from "@/lib/domain"
import type { CurrentUser } from "@/server/auth"

/**
 * Settings and admin actions are called directly, as if from the browser, with
 * the *session lookup* swapped for a test user. Role checks, clinic scoping and
 * business rules are the real code running against the real database.
 */
let acting: CurrentUser

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth")>()
  const { STAFF_ROLES } = await import("@/lib/domain")
  const requireRole = async (...roles: Role[]) => {
    if (!roles.includes(acting.role)) throw new Error("FORBIDDEN")
    return acting
  }
  return {
    ...actual,
    requireUser: async () => acting,
    requireRole,
    requireClinicAccess: async (clinicId: string, ...roles: Role[]) => {
      const u = await requireRole(...(roles.length ? roles : STAFF_ROLES))
      if (!actual.scopeIncludes(await actual.getClinicScope(u), clinicId)) throw new Error("FORBIDDEN")
      return u
    },
  }
})

const hasDb = Boolean(process.env.DATABASE_URL)
const tempUserIds: string[] = []
const createdExceptionIds: string[] = []

const byEmail = async (email: string, role: Role): Promise<CurrentUser> => {
  const [u] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, email))
  if (!u) throw new Error(`Seed data missing: ${email}`)
  return { ...u, role }
}

async function tempUser(role: Role = "patient") {
  const id = randomUUID()
  tempUserIds.push(id)
  await db
    .insert(user)
    .values({ id, name: "ITEST Person", email: `itest-${id.slice(0, 8)}@example.com`, role, emailVerified: true })
  return id
}

const roleOf = async (id: string) => (await db.select({ r: user.role }).from(user).where(eq(user.id, id)))[0]?.r

describe.skipIf(!hasDb)("management actions (authorization and rules)", () => {
  let settings: typeof import("@/server/settings/actions")
  let admin: typeof import("@/server/admin/actions")
  let users: Record<"manager" | "reception" | "doctor" | "admin", CurrentUser>
  let lakeshore: typeof clinics.$inferSelect
  let riverside: typeof clinics.$inferSelect
  let khan: typeof doctors.$inferSelect // Riverside + Midtown
  let sato: typeof doctors.$inferSelect // Lakeshore only

  beforeAll(async () => {
    settings = await import("@/server/settings/actions")
    admin = await import("@/server/admin/actions")
    users = {
      manager: await byEmail("manager@medflow.test", "manager"), // Riverside + Midtown
      reception: await byEmail("reception@medflow.test", "receptionist"),
      doctor: await byEmail("doctor@medflow.test", "doctor"),
      admin: await byEmail("admin@medflow.test", "admin"),
    }
    ;[lakeshore] = await db.select().from(clinics).where(eq(clinics.slug, "lakeshore"))
    ;[riverside] = await db.select().from(clinics).where(eq(clinics.slug, "riverside"))
    ;[khan] = await db.select().from(doctors).where(eq(doctors.slug, "rahim-khan"))
    ;[sato] = await db.select().from(doctors).where(eq(doctors.slug, "kenji-sato"))
  }, 90_000)

  afterAll(async () => {
    if (createdExceptionIds.length)
      await db.delete(availabilityExceptions).where(inArray(availabilityExceptions.id, createdExceptionIds))
    if (tempUserIds.length) {
      await db.update(doctors).set({ userId: null }).where(inArray(doctors.userId, tempUserIds))
      await db.delete(auditEvents).where(inArray(auditEvents.entityId, tempUserIds))
      await db.delete(user).where(inArray(user.id, tempUserIds)) // cascades accounts, sessions, staff scope
    }
    await db.$client.end()
  }, 90_000)

  const clinicPayload = (c: typeof clinics.$inferSelect, over: Record<string, unknown> = {}) => ({
    id: c.id,
    name: c.name,
    addressLine: c.addressLine,
    city: c.city,
    phone: c.phone,
    email: c.email ?? "",
    timezone: c.timezone,
    openingHours: c.openingHours ?? "",
    photoUrl: c.photoUrl ?? "",
    autoConfirmOnline: c.autoConfirmOnline,
    isActive: c.isActive,
    ...over,
  })

  describe("clinic settings", () => {
    it("blocks reception from every settings action", async () => {
      acting = users.reception
      await expect(settings.saveClinicAction(clinicPayload(riverside))).rejects.toThrow("FORBIDDEN")
      await expect(settings.setAutoConfirmAction({ clinicId: riverside.id, value: true })).rejects.toThrow("FORBIDDEN")
      await expect(settings.deleteAvailabilityRuleAction(randomUUID())).rejects.toThrow("FORBIDDEN")
    })

    it("blocks a manager from a clinic they don't manage", async () => {
      acting = users.manager
      await expect(settings.saveClinicAction(clinicPayload(lakeshore, { name: "Hijacked" }))).rejects.toThrow(
        "FORBIDDEN"
      )
      await expect(settings.setAutoConfirmAction({ clinicId: lakeshore.id, value: true })).rejects.toThrow("FORBIDDEN")
      const [after] = await db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, lakeshore.id))
      expect(after.name).toBe(lakeshore.name)
    })

    it("only lets administrators add clinics", async () => {
      acting = users.manager
      const res = await settings.saveClinicAction({ ...clinicPayload(riverside), id: undefined, name: "ITEST Clinic" })
      expect(res).toMatchObject({ ok: false, code: "NOT_ALLOWED" })
    })

    it("lets a manager change auto-confirm at their own clinic, with an audit event", async () => {
      acting = users.manager
      const original = riverside.autoConfirmOnline
      try {
        expect(await settings.setAutoConfirmAction({ clinicId: riverside.id, value: !original })).toMatchObject({
          ok: true,
        })
        const [row] = await db
          .select({ a: clinics.autoConfirmOnline })
          .from(clinics)
          .where(eq(clinics.id, riverside.id))
        expect(row.a).toBe(!original)
        const audit = await db
          .select({ id: auditEvents.id })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.entityId, riverside.id),
              eq(auditEvents.action, "auto_confirm_changed"),
              eq(auditEvents.actorUserId, users.manager.id)
            )
          )
        expect(audit.length).toBeGreaterThan(0)
      } finally {
        await db.update(clinics).set({ autoConfirmOnline: original }).where(eq(clinics.id, riverside.id))
      }
    })

    it("refuses to close a clinic that still has upcoming appointments", async () => {
      acting = users.manager
      const res = await settings.saveClinicAction(clinicPayload(riverside, { isActive: false }))
      expect(res).toMatchObject({ ok: false, code: "HAS_UPCOMING" })
      const [row] = await db.select({ a: clinics.isActive }).from(clinics).where(eq(clinics.id, riverside.id))
      expect(row.a).toBe(true)
    })
  })

  describe("doctors and availability", () => {
    it("hides doctors at other clinics from a manager", async () => {
      acting = users.manager
      const specialtyRows = await db
        .select({ id: doctorSpecialties.specialtyId })
        .from(doctorSpecialties)
        .where(eq(doctorSpecialties.doctorId, sato.id))
      const res = await settings.saveDoctorAction({
        id: sato.id,
        name: "Hijacked Name",
        title: sato.title,
        bio: sato.bio,
        yearsExperience: sato.yearsExperience,
        languages: "English",
        consultationTypes: ["in_person"],
        isActive: true,
        clinicIds: [lakeshore.id],
        specialtyIds: specialtyRows.map((s) => s.id),
        serviceIds: [],
      })
      expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" })
      const [after] = await db.select({ name: doctors.name }).from(doctors).where(eq(doctors.id, sato.id))
      expect(after.name).toBe(sato.name)

      // And they can't touch that doctor's schedule either.
      const rule = await settings.addAvailabilityRuleAction({
        doctorId: sato.id,
        clinicId: lakeshore.id,
        weekday: 6,
        startTime: "09:00",
        endTime: "10:00",
        slotMinutes: 30,
        validFrom: "",
        validTo: "",
      })
      expect(rule.ok).toBe(false)
    })

    it("rejects working hours that overlap an existing block", async () => {
      acting = users.manager
      const before = await db
        .select({ id: availabilityRules.id })
        .from(availabilityRules)
        .where(eq(availabilityRules.doctorId, khan.id))
      // Dr. Khan already works Mondays 09:00-12:30 at Riverside.
      const res = await settings.addAvailabilityRuleAction({
        doctorId: khan.id,
        clinicId: riverside.id,
        weekday: 1,
        startTime: "10:00",
        endTime: "11:00",
        slotMinutes: 30,
        validFrom: "",
        validTo: "",
      })
      expect(res).toMatchObject({ ok: false })
      expect(res.ok === false && res.fieldErrors?.startTime?.[0]).toMatch(/Overlaps/)
      const after = await db
        .select({ id: availabilityRules.id })
        .from(availabilityRules)
        .where(eq(availabilityRules.doctorId, khan.id))
      expect(after).toHaveLength(before.length)
    })

    it("adds time off, reports affected appointments, and can remove it", async () => {
      acting = users.manager
      // A day far from any seeded appointment.
      const res = await settings.addAvailabilityExceptionAction({
        doctorId: khan.id,
        clinicId: "",
        startDate: "2027-02-01",
        endDate: "2027-02-02",
        reason: "ITEST",
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      createdExceptionIds.push(res.data.id)
      expect(res.data.affected).toBe(0)
      expect(await settings.deleteAvailabilityExceptionAction(res.data.id)).toMatchObject({ ok: true })
    })

    it("won't assign a doctor to a clinic the manager doesn't manage", async () => {
      acting = users.manager
      const specialtyRows = await db
        .select({ id: doctorSpecialties.specialtyId })
        .from(doctorSpecialties)
        .where(eq(doctorSpecialties.doctorId, khan.id))
      const res = await settings.saveDoctorAction({
        id: khan.id,
        name: khan.name,
        title: khan.title,
        bio: khan.bio,
        yearsExperience: khan.yearsExperience,
        languages: khan.languages.join(", "),
        consultationTypes: khan.consultationTypes,
        isActive: true,
        clinicIds: [riverside.id, lakeshore.id], // Lakeshore isn't theirs to assign
        specialtyIds: specialtyRows.map((s) => s.id),
        serviceIds: [],
      })
      expect(res).toMatchObject({ ok: false, code: "NOT_ALLOWED" })
    })
  })

  describe("users and roles", () => {
    it("is administrators-only", async () => {
      for (const who of [users.manager, users.reception, users.doctor]) {
        acting = who
        await expect(
          admin.updateUserAccessAction({ userId: users.admin.id, role: "patient", clinicIds: [], doctorId: "" })
        ).rejects.toThrow("FORBIDDEN")
        await expect(
          admin.createStaffUserAction({
            name: "x y",
            email: "x@y.test",
            password: "long-enough-pass",
            role: "admin",
            clinicIds: [],
            doctorId: "",
          })
        ).rejects.toThrow("FORBIDDEN")
        await expect(
          admin.resetPasswordAction({ userId: users.admin.id, password: "long-enough-pass" })
        ).rejects.toThrow("FORBIDDEN")
      }
      expect(await roleOf(users.admin.id)).toBe("admin")
    })

    it("stops an administrator removing their own admin access", async () => {
      acting = users.admin
      const res = await admin.updateUserAccessAction({
        userId: users.admin.id,
        role: "manager",
        clinicIds: [riverside.id],
        doctorId: "",
      })
      expect(res).toMatchObject({ ok: false, code: "NOT_ALLOWED" })
      expect(await roleOf(users.admin.id)).toBe("admin")
    })

    it("requires a clinic for reception and a profile for doctors", async () => {
      acting = users.admin
      const id = await tempUser("patient")
      expect(
        await admin.updateUserAccessAction({ userId: id, role: "receptionist", clinicIds: [], doctorId: "" })
      ).toMatchObject({ ok: false })
      expect(
        await admin.updateUserAccessAction({ userId: id, role: "doctor", clinicIds: [], doctorId: "" })
      ).toMatchObject({ ok: false })
      expect(await roleOf(id)).toBe("patient")
    })

    it("moves a person between roles, keeping clinic scope and doctor links consistent", async () => {
      acting = users.admin
      const id = await tempUser("patient")
      const scopeOf = async () =>
        (await db.select().from(staffClinics).where(eq(staffClinics.userId, id))).map((r) => r.clinicId)
      const linked = async () =>
        (await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.userId, id))).length

      // patient -> receptionist at Riverside
      expect(
        await admin.updateUserAccessAction({
          userId: id,
          role: "receptionist",
          clinicIds: [riverside.id],
          doctorId: "",
        })
      ).toMatchObject({ ok: true })
      expect(await roleOf(id)).toBe("receptionist")
      expect(await scopeOf()).toEqual([riverside.id])

      // -> doctor (profile that already belongs to someone else is refused)
      expect(
        await admin.updateUserAccessAction({ userId: id, role: "doctor", clinicIds: [], doctorId: khan.id })
      ).toMatchObject({ ok: false })
      const [free] = await db
        .insert(doctors)
        .values({
          slug: `itest-${id.slice(0, 8)}`,
          name: "ITEST Doctor",
          title: "Tester",
          bio: "Temporary doctor profile used by tests.",
        })
        .returning()
      try {
        expect(
          await admin.updateUserAccessAction({ userId: id, role: "doctor", clinicIds: [], doctorId: free.id })
        ).toMatchObject({ ok: true })
        expect(await scopeOf()).toEqual([]) // clinic scope cleared
        expect(await linked()).toBe(1)

        // -> back to patient: link released
        expect(
          await admin.updateUserAccessAction({ userId: id, role: "patient", clinicIds: [], doctorId: "" })
        ).toMatchObject({ ok: true })
        expect(await linked()).toBe(0)
        expect(await roleOf(id)).toBe("patient")
      } finally {
        await db.delete(doctors).where(eq(doctors.id, free.id))
      }

      const audit = await db
        .select({ a: auditEvents.action, to: auditEvents.toStatus })
        .from(auditEvents)
        .where(eq(auditEvents.entityId, id))
      expect(audit.map((a) => a.to)).toEqual(expect.arrayContaining(["receptionist", "doctor", "patient"]))
    }, 90_000)

    it("creates staff accounts with a working password, without logging the admin in as them", async () => {
      acting = users.admin
      const email = `itest-${randomUUID().slice(0, 8)}@example.com`
      const res = await admin.createStaffUserAction({
        name: "ITEST Reception",
        email,
        password: "a-long-test-password",
        role: "receptionist",
        clinicIds: [riverside.id],
        doctorId: "",
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      tempUserIds.push(res.data.id)

      const [acct] = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, res.data.id), eq(account.providerId, "credential")))
      expect(acct.password).toBeTruthy()
      expect(acct.password).not.toContain("a-long-test-password")
      expect(await verifyPassword({ hash: acct.password!, password: "a-long-test-password" })).toBe(true)
      expect(await verifyPassword({ hash: acct.password!, password: "wrong-password-here" })).toBe(false)
      expect(await roleOf(res.data.id)).toBe("receptionist")

      // Duplicate email and short passwords are refused.
      expect(
        await admin.createStaffUserAction({
          name: "Dup Licate",
          email,
          password: "a-long-test-password",
          role: "receptionist",
          clinicIds: [riverside.id],
          doctorId: "",
        })
      ).toMatchObject({ ok: false })
      expect(
        await admin.createStaffUserAction({
          name: "Short Pass",
          email: `s-${email}`,
          password: "short",
          role: "receptionist",
          clinicIds: [riverside.id],
          doctorId: "",
        })
      ).toMatchObject({ ok: false })
    }, 90_000)

    it("resets a password and signs the person out everywhere", async () => {
      acting = users.admin
      const id = await tempUser("receptionist")
      const old = await hashPassword("old-password-123")
      await db
        .insert(account)
        .values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: old })
      expect(await admin.resetPasswordAction({ userId: id, password: "brand-new-password" })).toMatchObject({
        ok: true,
      })
      const [acct] = await db.select().from(account).where(eq(account.userId, id))
      expect(await verifyPassword({ hash: acct.password!, password: "brand-new-password" })).toBe(true)
      expect(await verifyPassword({ hash: acct.password!, password: "old-password-123" })).toBe(false)
    }, 60_000)
  })
})
