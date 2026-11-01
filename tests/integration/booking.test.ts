import "@/db/load-env"
import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { appointments, auditEvents, doctorServices, doctors, patients, services, user } from "@/db/schema"
import { getAvailableSlots } from "@/server/availability/queries"
import type { Slot } from "@/server/availability/slots"
import { createBooking, type CreateBookingParams } from "@/server/booking/create-booking"

/**
 * Hits the real database configured in DATABASE_URL (the Neon dev database).
 * It only ever creates its own patients and appointments and deletes them in
 * afterAll, so seeded data is untouched. Skipped when DATABASE_URL isn't set.
 */
const hasDb = Boolean(process.env.DATABASE_URL)
const DAY = 86_400_000
const created = { patientIds: [] as string[], appointmentIds: [] as string[] }

type Fixture = {
  actor: CreateBookingParams["actor"]
  doctorId: string
  clinicId: string
  serviceId: string
  slot: Slot
  durationMinutes: number
}

let fx: Fixture
type PoolEntry = { doctorId: string; serviceId: string; durationMinutes: number }
let pool: PoolEntry[] = []

async function newPatient(label: string) {
  const [p] = await db
    .insert(patients)
    .values({ firstName: "ITEST", lastName: label, phone: "555-0100", dateOfBirth: "1990-01-01" })
    .returning({ id: patients.id })
  created.patientIds.push(p.id)
  return p.id
}

function params(over: Partial<CreateBookingParams> & Pick<CreateBookingParams, "patientId">): CreateBookingParams {
  return {
    doctorId: fx.doctorId,
    clinicId: fx.clinicId,
    serviceId: fx.serviceId,
    consultationType: "in_person",
    startsAt: fx.slot.startsAt,
    reason: "Integration test booking",
    idempotencyKey: randomUUID(),
    source: "reception",
    actor: fx.actor,
    ...over,
  }
}

async function track<T extends { ok: boolean }>(result: T): Promise<T> {
  const r = result as unknown as { ok: boolean; appointment?: { id: string } }
  if (r.ok && r.appointment) created.appointmentIds.push(r.appointment.id)
  return result
}

async function slotsFor(doctorId: string, durationMinutes: number) {
  const from = new Date(Date.now() + 8 * DAY)
  return getAvailableSlots({ doctorId, from, to: new Date(from.getTime() + 25 * DAY), durationMinutes })
}

describe.skipIf(!hasDb)("createBooking (database)", () => {
  beforeAll(async () => {
    const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.email, "admin@medflow.test"))
    if (!admin) throw new Error("Seed data missing: run `npm run db:seed` first.")

    pool = await db
      .select({
        doctorId: doctors.id,
        serviceId: services.id,
        durationMinutes: services.durationMinutes,
      })
      .from(doctors)
      .innerJoin(doctorServices, eq(doctorServices.doctorId, doctors.id))
      .innerJoin(services, eq(services.id, doctorServices.serviceId))
      .where(and(eq(doctors.isActive, true), eq(services.isActive, true)))

    // Choose the first doctor/service pair with a bookable slot a week or more away.
    for (const candidate of pool) {
      const slots = await slotsFor(candidate.doctorId, candidate.durationMinutes)
      if (slots.length) {
        const slot = slots[Math.floor(slots.length / 2)]
        fx = {
          actor: { id: admin.id, role: "admin" },
          doctorId: candidate.doctorId,
          clinicId: slot.clinicId,
          serviceId: candidate.serviceId,
          slot,
          durationMinutes: candidate.durationMinutes,
        }
        break
      }
    }
    if (!fx) throw new Error("No bookable slot found in the seed data")
  }, 60_000)

  afterAll(async () => {
    if (created.appointmentIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.entityId, created.appointmentIds))
    }
    if (created.patientIds.length) {
      await db.delete(appointments).where(inArray(appointments.patientId, created.patientIds))
      await db.delete(patients).where(inArray(patients.id, created.patientIds))
    }
    await db.$client.end()
  }, 60_000)

  it("lets exactly one of 10 simultaneous bookings for the same slot succeed", async () => {
    const patientIds = await Promise.all(Array.from({ length: 10 }, (_, i) => newPatient(`race-${i}`)))

    const results = await Promise.all(
      patientIds.map(async (patientId) => track(await createBooking(params({ patientId }))))
    )

    const winners = results.filter((r) => r.ok)
    const losers = results.filter((r) => !r.ok)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(9)
    for (const loser of losers) {
      expect(loser.ok === false && loser.error.code).toBe("SLOT_TAKEN")
    }

    // The database agrees: one active appointment holds that slot.
    const rows = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.doctorId, fx.doctorId), eq(appointments.startsAt, fx.slot.startsAt)))
    expect(rows).toHaveLength(1)
  }, 60_000)

  it("offers alternative slots when the requested time is taken", async () => {
    const result = await createBooking(params({ patientId: await newPatient("alt") }))
    expect(result.ok).toBe(false)
    if (result.ok || result.error.code !== "SLOT_TAKEN") throw new Error("expected SLOT_TAKEN")
    expect(result.error.alternatives.length).toBeGreaterThan(0)
    expect(result.error.alternatives.every((s) => s.startsAt.getTime() !== fx.slot.startsAt.getTime())).toBe(true)
  }, 60_000)

  it("replays a repeated idempotency key instead of creating a second appointment", async () => {
    const [{ id: takenId }] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.doctorId, fx.doctorId), eq(appointments.startsAt, fx.slot.startsAt)))
    const original = await db
      .select({ key: appointments.idempotencyKey, patientId: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.id, takenId))
    const { key, patientId } = original[0]

    const again = await createBooking(params({ patientId, idempotencyKey: key! }))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.replayed).toBe(true)
    expect(again.appointment.id).toBe(takenId)

    // The same key for a different patient must not leak or reuse the booking.
    const stranger = await createBooking(params({ patientId: await newPatient("stranger"), idempotencyKey: key! }))
    expect(stranger.ok === false && stranger.error.code).toBe("IDEMPOTENCY_CONFLICT")
  }, 60_000)

  it("rejects times that aren't on the doctor's schedule", async () => {
    const offGrid = new Date(fx.slot.startsAt.getTime() + 7 * 60_000)
    const result = await createBooking(params({ patientId: await newPatient("offgrid"), startsAt: offGrid }))
    expect(result.ok === false && result.error.code).toBe("INVALID_SLOT")

    const past = new Date(Date.now() - DAY)
    const pastResult = await createBooking(params({ patientId: await newPatient("past"), startsAt: past }))
    expect(pastResult.ok === false && pastResult.error.code).toBe("INVALID_SLOT")
  }, 60_000)

  it("stops one patient holding two overlapping appointments with different doctors", async (ctx) => {
    // Find two different doctors who each have a free slot overlapping the other's.
    const firstPerDoctor = [...new Map(pool.map((e) => [e.doctorId, e])).values()]
    const withSlots = await Promise.all(
      firstPerDoctor.map(async (e) => ({ ...e, slots: await slotsFor(e.doctorId, e.durationMinutes) }))
    )
    let pair: { a: PoolEntry & { slot: Slot }; b: PoolEntry & { slot: Slot } } | null = null
    search: for (const a of withSlots) {
      for (const b of withSlots) {
        if (a.doctorId === b.doctorId) continue
        for (const sa of a.slots) {
          const sb = b.slots.find((s) => s.startsAt < sa.endsAt && sa.startsAt < s.endsAt)
          if (sb) {
            pair = { a: { ...a, slot: sa }, b: { ...b, slot: sb } }
            break search
          }
        }
      }
    }
    if (!pair) return ctx.skip()

    const patientId = await newPatient("double-book")
    const book = (e: PoolEntry & { slot: Slot }) =>
      createBooking(
        params({
          patientId,
          doctorId: e.doctorId,
          clinicId: e.slot.clinicId,
          serviceId: e.serviceId,
          startsAt: e.slot.startsAt,
        })
      )

    expect((await track(await book(pair.b))).ok).toBe(true)
    const second = await book(pair.a)
    expect(second.ok).toBe(false)
    expect(second.ok === false && second.error.code).toBe("PATIENT_CONFLICT")
  }, 60_000)
})
