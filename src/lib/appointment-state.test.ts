import { describe, expect, it } from "vitest"
import { availableTransitions, canTransition } from "./appointment-state"

const now = new Date("2026-03-10T12:00:00Z")
const future = new Date("2026-03-11T09:00:00Z")
const past = new Date("2026-03-10T09:00:00Z")

describe("canTransition", () => {
  it("lets reception confirm a requested appointment", () => {
    expect(canTransition("requested", "confirmed", { role: "receptionist", now })).toEqual({ allowed: true })
  })

  it("never leaves a final status", () => {
    for (const to of ["requested", "confirmed", "checked_in"] as const) {
      expect(canTransition("cancelled", to, { role: "admin", now }).allowed).toBe(false)
      expect(canTransition("completed", to, { role: "admin", now }).allowed).toBe(false)
    }
  })

  it("lets a patient cancel only their own future appointment", () => {
    expect(
      canTransition("confirmed", "cancelled", { role: "patient", isOwner: true, startsAt: future, now }).allowed
    ).toBe(true)
    expect(
      canTransition("confirmed", "cancelled", { role: "patient", isOwner: false, startsAt: future, now }).allowed
    ).toBe(false)
    expect(
      canTransition("confirmed", "cancelled", { role: "patient", isOwner: true, startsAt: past, now }).allowed
    ).toBe(false)
  })

  it("does not let a patient confirm", () => {
    expect(
      canTransition("requested", "confirmed", { role: "patient", isOwner: true, startsAt: future, now }).allowed
    ).toBe(false)
  })

  it("does not let a doctor check in or cancel", () => {
    expect(canTransition("confirmed", "checked_in", { role: "doctor", now }).allowed).toBe(false)
    expect(canTransition("confirmed", "cancelled", { role: "doctor", now }).allowed).toBe(false)
  })

  it("only allows a no-show after the start time", () => {
    expect(canTransition("confirmed", "no_show", { role: "receptionist", startsAt: future, now }).allowed).toBe(false)
    expect(canTransition("confirmed", "no_show", { role: "receptionist", startsAt: past, now }).allowed).toBe(true)
  })
})

describe("availableTransitions", () => {
  it("offers a doctor only completion of a checked-in visit", () => {
    expect(availableTransitions("checked_in", { role: "doctor", now })).toEqual(["completed"])
    expect(availableTransitions("confirmed", { role: "doctor", now })).toEqual([])
  })
})
