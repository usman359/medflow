"use server"

import { and, count, eq, gt, inArray, lt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db, type DbOrTx } from "@/db"
import {
  appointments,
  availabilityExceptions,
  availabilityRules,
  clinics,
  doctorClinics,
  doctors,
  doctorServices,
  doctorSpecialties,
  services,
} from "@/db/schema"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { clinicSchema, doctorSchema, exceptionSchema, ruleSchema, serviceSchema } from "@/lib/validation/settings"
import { recordAudit } from "@/server/audit"
import { getClinicScope, requireClinicAccess, requireRole, type CurrentUser } from "@/server/auth"
import { clinicDayRange } from "@/server/appointments/staff-queries"

const ROLES = ["manager", "admin"] as const
const done = () => revalidatePath("/staff/manager/settings")
const actor = (u: CurrentUser) => ({ id: u.id, role: u.role })
const OPEN = ["requested", "confirmed", "checked_in"] as const

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/^dr\.?\s+/, "")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  )
}

async function uniqueSlug(conn: DbOrTx, table: typeof clinics | typeof doctors | typeof services, base: string) {
  const rows = await conn.select({ slug: table.slug }).from(table)
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Upcoming appointments that would be stranded by a change. Past and finished appointments don't count. */
async function upcomingCount(where: ReturnType<typeof and>) {
  const [row] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(where, inArray(appointments.status, [...OPEN]), gt(appointments.endsAt, new Date())))
  return row.n
}

/** The clinic ids a user may manage, or "all". */
async function managed(user: CurrentUser) {
  return getClinicScope(user)
}

/* ------------------------------------------------------------------ Clinics */

export async function saveClinicAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole(...ROLES)
  const parsed = clinicSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { id, ...values } = parsed.data

  if (!id) {
    if (user.role !== "admin")
      return { ok: false, code: "NOT_ALLOWED", error: "Only a system administrator can add a clinic." }
    const created = await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, clinics, slugify(values.name))
      const [row] = await tx
        .insert(clinics)
        .values({ ...values, slug })
        .returning({ id: clinics.id })
      await recordAudit(tx, {
        actor: actor(user),
        entityType: "clinic",
        entityId: row.id,
        action: "created",
        metadata: { name: values.name },
      })
      return row
    })
    done()
    return { ok: true, data: { id: created.id } }
  }

  await requireClinicAccess(id, ...ROLES)
  if (!values.isActive) {
    const n = await upcomingCount(eq(appointments.clinicId, id))
    if (n > 0) {
      return {
        ok: false,
        code: "HAS_UPCOMING",
        error: `This clinic has ${n} upcoming appointment${n === 1 ? "" : "s"}. Cancel or move them before deactivating it.`,
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(clinics).set(values).where(eq(clinics.id, id))
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "clinic",
      entityId: id,
      action: "updated",
      metadata: { name: values.name, autoConfirmOnline: values.autoConfirmOnline, isActive: values.isActive },
    })
  })
  done()
  revalidatePath("/", "layout")
  return { ok: true, data: { id } }
}

export async function setAutoConfirmAction(input: { clinicId: string; value: boolean }): Promise<ActionResult> {
  const user = await requireRole(...ROLES)
  if (typeof input?.clinicId !== "string" || typeof input?.value !== "boolean")
    return { ok: false, error: "Invalid request." }
  await requireClinicAccess(input.clinicId, ...ROLES)
  await db.transaction(async (tx) => {
    await tx.update(clinics).set({ autoConfirmOnline: input.value }).where(eq(clinics.id, input.clinicId))
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "clinic",
      entityId: input.clinicId,
      action: "auto_confirm_changed",
      metadata: { autoConfirmOnline: input.value },
    })
  })
  done()
  return { ok: true, data: undefined }
}

/* ------------------------------------------------------------------ Doctors */

export async function saveDoctorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole(...ROLES)
  const parsed = doctorSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { id, clinicIds: requestedClinicIds, specialtyIds, serviceIds, ...profile } = parsed.data
  const scope = await managed(user)
  const inScope = (clinicId: string) => scope === "all" || scope.includes(clinicId)

  // Every referenced clinic, specialty and service must exist (and services must be active).
  const [clinicRows, svcRows] = await Promise.all([
    db.select({ id: clinics.id, name: clinics.name }).from(clinics).where(inArray(clinics.id, requestedClinicIds)),
    serviceIds.length
      ? db
          .select({ id: services.id })
          .from(services)
          .where(and(inArray(services.id, serviceIds), eq(services.isActive, true)))
      : [],
  ])
  if (clinicRows.length !== requestedClinicIds.length)
    return { ok: false, error: "One of the selected clinics no longer exists." }
  if (svcRows.length !== serviceIds.length) return { ok: false, error: "One of the selected services is unavailable." }

  let currentClinicIds: string[] = []
  if (id) {
    currentClinicIds = (
      await db.select({ c: doctorClinics.clinicId }).from(doctorClinics).where(eq(doctorClinics.doctorId, id))
    ).map((r) => r.c)
    const [exists] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, id))
    // Managers only reach doctors who work at one of their clinics; to them anyone else doesn't exist.
    if (!exists || (scope !== "all" && !currentClinicIds.some(inScope))) {
      return { ok: false, code: "NOT_FOUND", error: "We couldn't find that doctor." }
    }
  }

  // A manager can only add or remove clinics they manage; other assignments are left as they are.
  const added = requestedClinicIds.filter((c) => !currentClinicIds.includes(c))
  if (added.some((c) => !inScope(c)))
    return { ok: false, code: "NOT_ALLOWED", error: "You can only assign doctors to your own clinics." }
  const removed = currentClinicIds.filter((c) => !requestedClinicIds.includes(c))
  if (removed.some((c) => !inScope(c)))
    return { ok: false, code: "NOT_ALLOWED", error: "You can't remove a doctor from a clinic you don't manage." }
  if (!id && !requestedClinicIds.some(inScope))
    return { ok: false, error: "Assign the doctor to at least one of your clinics." }

  if (id && removed.length) {
    const n = await upcomingCount(and(eq(appointments.doctorId, id), inArray(appointments.clinicId, removed)))
    if (n > 0)
      return {
        ok: false,
        code: "HAS_UPCOMING",
        error: `This doctor has ${n} upcoming appointment${n === 1 ? "" : "s"} at a clinic you're removing. Cancel or move them first.`,
      }
  }
  if (id && !profile.isActive) {
    const n = await upcomingCount(eq(appointments.doctorId, id))
    if (n > 0)
      return {
        ok: false,
        code: "HAS_UPCOMING",
        error: `This doctor has ${n} upcoming appointment${n === 1 ? "" : "s"}. Cancel or move them before deactivating.`,
      }
  }

  const saved = await db.transaction(async (tx) => {
    let doctorId = id
    if (doctorId) {
      await tx.update(doctors).set(profile).where(eq(doctors.id, doctorId))
    } else {
      const slug = await uniqueSlug(tx, doctors, slugify(profile.name))
      const [row] = await tx
        .insert(doctors)
        .values({ ...profile, slug })
        .returning({ id: doctors.id })
      doctorId = row.id
    }

    // Replace the join rows: clinics (and the schedule at clinics that were removed), specialties, services.
    await tx.delete(doctorClinics).where(eq(doctorClinics.doctorId, doctorId))
    await tx.insert(doctorClinics).values(requestedClinicIds.map((clinicId) => ({ doctorId, clinicId })))
    if (removed.length) {
      // Without this, slots would still be offered at a clinic the doctor no longer works at.
      await tx
        .delete(availabilityRules)
        .where(and(eq(availabilityRules.doctorId, doctorId), inArray(availabilityRules.clinicId, removed)))
    }
    await tx.delete(doctorSpecialties).where(eq(doctorSpecialties.doctorId, doctorId))
    await tx.insert(doctorSpecialties).values(specialtyIds.map((specialtyId) => ({ doctorId, specialtyId })))
    await tx.delete(doctorServices).where(eq(doctorServices.doctorId, doctorId))
    if (serviceIds.length)
      await tx.insert(doctorServices).values(serviceIds.map((serviceId) => ({ doctorId, serviceId })))

    await recordAudit(tx, {
      actor: actor(user),
      entityType: "doctor",
      entityId: doctorId,
      action: id ? "updated" : "created",
      metadata: { name: profile.name, isActive: profile.isActive },
    })
    return { id: doctorId }
  })
  done()
  revalidatePath("/doctors")
  revalidatePath("/", "layout")
  return { ok: true, data: saved }
}

/* ----------------------------------------------------------------- Services */

export async function saveServiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole(...ROLES)
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { id, price, ...values } = parsed.data
  const row = { ...values, priceCents: Math.round(price * 100) }

  const saved = await db.transaction(async (tx) => {
    if (id) {
      const updated = await tx.update(services).set(row).where(eq(services.id, id)).returning({ id: services.id })
      if (updated.length === 0) return null
      await recordAudit(tx, {
        actor: actor(user),
        entityType: "service",
        entityId: id,
        action: "updated",
        metadata: { name: values.name, priceCents: row.priceCents },
      })
      return { id }
    }
    const slug = await uniqueSlug(tx, services, slugify(values.name))
    const [created] = await tx
      .insert(services)
      .values({ ...row, slug })
      .returning({ id: services.id })
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "service",
      entityId: created.id,
      action: "created",
      metadata: { name: values.name },
    })
    return created
  })
  if (!saved) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that service." }
  done()
  revalidatePath("/services")
  return { ok: true, data: saved }
}

/* ------------------------------------------------------------- Availability */

/** The doctor must work at a clinic this user manages; otherwise they "don't exist" to them. */
async function requireManagedDoctor(user: CurrentUser, doctorId: string) {
  const scope = await managed(user)
  const rows = await db
    .select({ clinicId: doctorClinics.clinicId })
    .from(doctorClinics)
    .where(eq(doctorClinics.doctorId, doctorId))
  const clinicIds = rows.map((r) => r.clinicId)
  if (clinicIds.length === 0 || (scope !== "all" && !clinicIds.some((c) => scope.includes(c)))) return null
  return { clinicIds, scope }
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export async function addAvailabilityRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole(...ROLES)
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const rule = parsed.data

  const ctx = await requireManagedDoctor(user, rule.doctorId)
  if (!ctx) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that doctor." }
  await requireClinicAccess(rule.clinicId, ...ROLES)
  if (!ctx.clinicIds.includes(rule.clinicId))
    return { ok: false, error: "This doctor doesn't work at that clinic. Add the clinic to their profile first." }

  // A doctor can't be in two places at once: no overlapping hours on the same weekday at any clinic.
  const existing = await db
    .select()
    .from(availabilityRules)
    .where(and(eq(availabilityRules.doctorId, rule.doctorId), eq(availabilityRules.weekday, rule.weekday)))
  const datesOverlap = (a: { validFrom: string | null; validTo: string | null }) =>
    (!a.validTo || !rule.validFrom || a.validTo >= rule.validFrom) &&
    (!rule.validTo || !a.validFrom || rule.validTo >= a.validFrom)
  const clash = existing.find(
    (e) =>
      toMinutes(e.startTime) < toMinutes(rule.endTime) &&
      toMinutes(rule.startTime) < toMinutes(e.endTime) &&
      datesOverlap(e)
  )
  if (clash) {
    return {
      ok: false,
      fieldErrors: {
        startTime: [`Overlaps ${clash.startTime.slice(0, 5)}–${clash.endTime.slice(0, 5)} on the same day.`],
      },
      error: "These hours overlap an existing block.",
    }
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(availabilityRules).values(rule).returning({ id: availabilityRules.id })
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "availability",
      entityId: rule.doctorId,
      action: "rule_added",
      metadata: { clinicId: rule.clinicId, weekday: rule.weekday, start: rule.startTime, end: rule.endTime },
    })
    return row
  })
  done()
  return { ok: true, data: created }
}

export async function deleteAvailabilityRuleAction(ruleId: unknown): Promise<ActionResult> {
  const user = await requireRole(...ROLES)
  if (typeof ruleId !== "string") return { ok: false, error: "Invalid request." }
  const [rule] = await db.select().from(availabilityRules).where(eq(availabilityRules.id, ruleId))
  if (!rule) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that block." }
  await requireClinicAccess(rule.clinicId, ...ROLES)
  await db.transaction(async (tx) => {
    await tx.delete(availabilityRules).where(eq(availabilityRules.id, ruleId))
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "availability",
      entityId: rule.doctorId,
      action: "rule_deleted",
      metadata: { clinicId: rule.clinicId, weekday: rule.weekday },
    })
  })
  done()
  return { ok: true, data: undefined }
}

export async function addAvailabilityExceptionAction(
  input: unknown
): Promise<ActionResult<{ id: string; affected: number }>> {
  const user = await requireRole(...ROLES)
  const parsed = exceptionSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)
  const { doctorId, clinicId, startDate, endDate, reason } = parsed.data

  const ctx = await requireManagedDoctor(user, doctorId)
  if (!ctx) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that doctor." }
  if (clinicId) {
    await requireClinicAccess(clinicId, ...ROLES)
    if (!ctx.clinicIds.includes(clinicId)) return { ok: false, error: "This doctor doesn't work at that clinic." }
  }

  // Interpret the dates in the clinic's timezone (or the doctor's first clinic when it applies everywhere).
  const [tzRow] = await db
    .select({ timezone: clinics.timezone })
    .from(clinics)
    .where(clinicId ? eq(clinics.id, clinicId) : inArray(clinics.id, ctx.clinicIds))
    .limit(1)
  const tz = tzRow?.timezone ?? "America/New_York"
  const startsAt = clinicDayRange(tz, startDate).start
  const endsAt = clinicDayRange(tz, endDate).end

  // Existing bookings aren't touched; tell the manager how many need rescheduling.
  const affected = await upcomingCount(
    and(
      eq(appointments.doctorId, doctorId),
      lt(appointments.startsAt, endsAt),
      gt(appointments.endsAt, startsAt),
      clinicId ? eq(appointments.clinicId, clinicId) : undefined
    )
  )

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(availabilityExceptions)
      .values({ doctorId, clinicId, startsAt, endsAt, reason })
      .returning({ id: availabilityExceptions.id })
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "availability",
      entityId: doctorId,
      action: "time_off_added",
      metadata: { clinicId, startDate, endDate, affected },
    })
    return row
  })
  done()
  return { ok: true, data: { id: created.id, affected } }
}

export async function deleteAvailabilityExceptionAction(exceptionId: unknown): Promise<ActionResult> {
  const user = await requireRole(...ROLES)
  if (typeof exceptionId !== "string") return { ok: false, error: "Invalid request." }
  const [ex] = await db.select().from(availabilityExceptions).where(eq(availabilityExceptions.id, exceptionId))
  if (!ex) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that entry." }
  const ctx = await requireManagedDoctor(user, ex.doctorId)
  if (!ctx) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that entry." }
  if (ex.clinicId) await requireClinicAccess(ex.clinicId, ...ROLES)
  await db.transaction(async (tx) => {
    await tx.delete(availabilityExceptions).where(eq(availabilityExceptions.id, exceptionId))
    await recordAudit(tx, {
      actor: actor(user),
      entityType: "availability",
      entityId: ex.doctorId,
      action: "time_off_deleted",
      metadata: { clinicId: ex.clinicId },
    })
  })
  done()
  return { ok: true, data: undefined }
}
