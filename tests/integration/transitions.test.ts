import "@/db/load-env"
import { randomUUID } from "node:crypto"
import { and, eq, inArray, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { appointments, auditEvents, clinics, doctors, notifications, patients, services, user } from "@/db/schema"
import type { Role } from "@/lib/domain"
import { getAvailableSlots } from "@/server/availability/queries"
import { createBooking } from "@/server/booking/create-booking"
import { transitionAppointment } from "@/server/appointments/transition"
import type { CurrentUser } from "@/server/auth"

/**
 * Authorization rules for status changes, run against the seeded dev database.
 * Creates its own appointments (for the seeded demo patient) and removes them in afterAll.
 */
const hasDb = Boolean(process.env.DATABASE_URL)
const DAY = 86_400_000
const createdAppointmentIds: string[] = []

const actors = {} as Record<
  "patient" | "otherPatient" | "reception" | "receptionOtherClinic" | "doctor" | "otherDoctor" | "manager" | "admin",
  CurrentUser
>
let riverside: { doctorId: string; clinicId: string; serviceId: string; slots: Date[]; durationMinutes: number }
let patientRecordId: string

async function userByEmail(email: string, role: Role): Promise<CurrentUser> {
  const [u] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, email))
  if (!u) throw new Error(`Seed data missing: ${email}. Run \`npm run db:seed\`.`)
  return { ...u, role }
}

/** A fresh appointment for the demo patient with Dr. Khan at Riverside, in the given status. */
async function freshAppointment(status: "requested" | "confirmed" | "checked_in", dayOffset = 0) {
  const slot = riverside.slots.shift()
  if (!slot) throw new Error("Ran out of test slots")
  const result = await createBooking({
    doctorId: riverside.doctorId,
    clinicId: riverside.clinicId,
    serviceId: riverside.serviceId,
    consultationType: "in_person",
    startsAt: new Date(slot.getTime() + dayOffset * DAY),
    reason: "Integration test",
    idempotencyKey: randomUUID(),
    patientId: patientRecordId,
    source: "reception",
    actor: { id: actors.admin.id, role: "admin" },
  })
  if (!result.ok) throw new Error(`setup booking failed: ${result.error.code}`)
  const id = result.appointment.id
  createdAppointmentIds.push(id)
  if (status !== "confirmed") await db.update(appointments).set({ status }).where(eq(appointments.id, id))
  return id
}

const statusOf = async (id: string) =>
  (await db.select({ s: appointments.status }).from(appointments).where(eq(appointments.id, id)))[0].s

describe.skipIf(!hasDb)("transitionAppointment (authorization)", () => {
  beforeAll(async () => {
    actors.patient = await userByEmail("patient@medflow.test", "patient")
    actors.otherPatient = await userByEmail("olivia.johnson@example.com", "patient")
    actors.reception = await userByEmail("reception@medflow.test", "receptionist") // Riverside only
    actors.receptionOtherClinic = await userByEmail("reception.midtown@medflow.test", "receptionist")
    actors.doctor = await userByEmail("doctor@medflow.test", "doctor") // Dr. Khan
    actors.otherDoctor = await userByEmail("elena.morales@medflow.test", "doctor")
    actors.manager = await userByEmail("manager@medflow.test", "manager")
    actors.admin = await userByEmail("admin@medflow.test", "admin")

    const [p] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, actors.patient.id))
    patientRecordId = p.id

    const [doctor] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.userId, actors.doctor.id))
    const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.slug, "riverside"))
    const [service] = await db
      .select({ id: services.id, durationMinutes: services.durationMinutes })
      .from(services)
      .where(eq(services.slug, "general-consultation"))

    const from = new Date(Date.now() + 9 * DAY)
    const free = await getAvailableSlots({
      doctorId: doctor.id,
      clinicId: clinic.id,
      from,
      to: new Date(from.getTime() + 25 * DAY),
      durationMinutes: service.durationMinutes,
    })
    // Spread test appointments out so they never overlap each other (the patient constraint is global).
    const spaced: Date[] = []
    for (const s of free) {
      if (spaced.every((d) => Math.abs(d.getTime() - s.startsAt.getTime()) > 2 * DAY)) spaced.push(s.startsAt)
    }
    riverside = {
      doctorId: doctor.id,
      clinicId: clinic.id,
      serviceId: service.id,
      slots: spaced,
      durationMinutes: service.durationMinutes,
    }
    expect(spaced.length).toBeGreaterThanOrEqual(7)
  }, 90_000)

  afterAll(async () => {
    if (createdAppointmentIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.entityId, createdAppointmentIds))
      for (const id of createdAppointmentIds) {
        await db.delete(notifications).where(like(notifications.link, `%${id}%`))
      }
      await db.delete(appointments).where(inArray(appointments.id, createdAppointmentIds))
    }
    await db.$client.end()
  }, 90_000)

  it("hides appointments from reception at another clinic (looks identical to 'not found')", async () => {
    const id = await freshAppointment("requested")
    const res = await transitionAppointment(actors.receptionOtherClinic, { appointmentId: id, to: "confirmed" })
    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" })
    expect(await statusOf(id)).toBe("requested")

    const unknown = await transitionAppointment(actors.receptionOtherClinic, {
      appointmentId: randomUUID(),
      to: "confirmed",
    })
    expect(unknown).toMatchObject({ ok: false, code: "NOT_FOUND" })
  }, 60_000)

  it("lets reception at the right clinic confirm, and records audit + notifies the patient", async () => {
    const id = await freshAppointment("requested")
    const res = await transitionAppointment(actors.reception, { appointmentId: id, to: "confirmed" })
    expect(res).toEqual({ ok: true, status: "confirmed" })
    expect(await statusOf(id)).toBe("confirmed")

    const audit = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.entityId, id), eq(auditEvents.action, "status_changed")))
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ fromStatus: "requested", toStatus: "confirmed", actorUserId: actors.reception.id })

    const notes = await db
      .select()
      .from(notifications)
      .where(like(notifications.link, `%${id}%`))
    expect(notes.some((n) => n.type === "appointment_confirmed" && n.userId === actors.patient.id)).toBe(true)
  }, 60_000)

  it("applies exactly one of two simultaneous conflicting changes", async () => {
    const id = await freshAppointment("confirmed")
    const [a, b] = await Promise.all([
      transitionAppointment(actors.reception, { appointmentId: id, to: "cancelled", reason: "race a" }),
      transitionAppointment(actors.manager, { appointmentId: id, to: "checked_in" }),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    const loser = a.ok ? b : a
    expect(loser.ok === false && ["CONFLICT", "NOT_ALLOWED"].includes(loser.code)).toBe(true)
    expect(["cancelled", "checked_in"]).toContain(await statusOf(id))
  }, 60_000)

  it("rejects a stale view with a clear conflict", async () => {
    const id = await freshAppointment("confirmed")
    const res = await transitionAppointment(actors.reception, {
      appointmentId: id,
      to: "checked_in",
      expectedFrom: "requested",
    })
    expect(res).toMatchObject({ ok: false, code: "CONFLICT" })
    expect(await statusOf(id)).toBe("confirmed")
  }, 60_000)

  it("enforces ownership and role limits for patients", async () => {
    const id = await freshAppointment("confirmed")
    // Someone else's appointment: not found.
    expect(await transitionAppointment(actors.otherPatient, { appointmentId: id, to: "cancelled" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    })
    // Own appointment, but patients can't check themselves in or confirm.
    expect(await transitionAppointment(actors.patient, { appointmentId: id, to: "checked_in" })).toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    })
    const requested = await freshAppointment("requested")
    expect(await transitionAppointment(actors.patient, { appointmentId: requested, to: "confirmed" })).toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    })
    // Own appointment, before it starts: allowed.
    expect(
      await transitionAppointment(actors.patient, { appointmentId: id, to: "cancelled", reason: "Plans changed" })
    ).toEqual({
      ok: true,
      status: "cancelled",
    })
    // Final states can't be reopened by anyone, not even an admin.
    expect(await transitionAppointment(actors.admin, { appointmentId: id, to: "confirmed" })).toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    })
  }, 90_000)

  it("limits doctors to their own patients and to completing visits", async () => {
    const id = await freshAppointment("checked_in")
    // Another doctor can't see it.
    expect(await transitionAppointment(actors.otherDoctor, { appointmentId: id, to: "completed" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    })
    // The right doctor can't cancel, but can complete.
    expect(await transitionAppointment(actors.doctor, { appointmentId: id, to: "cancelled" })).toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    })
    expect(await transitionAppointment(actors.doctor, { appointmentId: id, to: "completed" })).toEqual({
      ok: true,
      status: "completed",
    })
  }, 60_000)

  it("won't mark a no-show before the appointment starts", async () => {
    const id = await freshAppointment("confirmed")
    expect(await transitionAppointment(actors.reception, { appointmentId: id, to: "no_show" })).toMatchObject({
      ok: false,
      code: "NOT_ALLOWED",
    })
  }, 60_000)
})
