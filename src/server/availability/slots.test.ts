import { describe, expect, it } from "vitest"
import { generateSlots, isGeneratedSlot, type SlotRule } from "./slots"

const NY = "America/New_York"
const clinicId = "clinic-a"

// Monday 2026-03-09, 09:00–11:00 New York (EDT, UTC-4 after the 2026-03-08 DST change).
const mondayRule: SlotRule = {
  clinicId,
  timeZone: NY,
  weekday: 1,
  startTime: "09:00",
  endTime: "11:00",
  slotMinutes: 30,
}
const monday = { from: new Date("2026-03-09T00:00:00-04:00"), to: new Date("2026-03-10T00:00:00-04:00") }
const longAgo = new Date("2026-01-01T00:00:00Z")

const iso = (slots: { startsAt: Date }[]) => slots.map((s) => s.startsAt.toISOString())

describe("generateSlots", () => {
  it("expands a weekly rule into back-to-back slots in the clinic timezone", () => {
    const slots = generateSlots({ rules: [mondayRule], busy: [], ...monday, durationMinutes: 30, now: longAgo })
    expect(iso(slots)).toEqual([
      "2026-03-09T13:00:00.000Z",
      "2026-03-09T13:30:00.000Z",
      "2026-03-09T14:00:00.000Z",
      "2026-03-09T14:30:00.000Z",
    ])
  })

  it("only offers starts where the whole appointment fits before the block ends", () => {
    const slots = generateSlots({ rules: [mondayRule], busy: [], ...monday, durationMinutes: 60, now: longAgo })
    expect(iso(slots)).toEqual(["2026-03-09T13:00:00.000Z", "2026-03-09T13:30:00.000Z", "2026-03-09T14:00:00.000Z"])
  })

  it("removes slots that partially overlap an appointment, but keeps back-to-back ones", () => {
    const busy = [{ startsAt: new Date("2026-03-09T13:45:00Z"), endsAt: new Date("2026-03-09T14:00:00Z") }]
    const slots = generateSlots({ rules: [mondayRule], busy, ...monday, durationMinutes: 30, now: longAgo })
    expect(iso(slots)).toEqual(["2026-03-09T13:00:00.000Z", "2026-03-09T14:00:00.000Z", "2026-03-09T14:30:00.000Z"])
  })

  it("respects time off, including time off scoped to another clinic", () => {
    const busy = [
      {
        startsAt: new Date("2026-03-09T00:00:00-04:00"),
        endsAt: new Date("2026-03-09T10:00:00-04:00"),
        clinicId: null,
      },
      {
        startsAt: new Date("2026-03-09T10:00:00-04:00"),
        endsAt: new Date("2026-03-09T11:00:00-04:00"),
        clinicId: "other",
      },
    ]
    const slots = generateSlots({ rules: [mondayRule], busy, ...monday, durationMinutes: 30, now: longAgo })
    expect(iso(slots)).toEqual(["2026-03-09T14:00:00.000Z", "2026-03-09T14:30:00.000Z"])
  })

  it("drops past slots and slots inside the lead time", () => {
    const now = new Date("2026-03-09T13:10:00Z") // 09:10 local
    const slots = generateSlots({ rules: [mondayRule], busy: [], ...monday, durationMinutes: 30, now, leadMinutes: 60 })
    expect(iso(slots)).toEqual(["2026-03-09T14:30:00.000Z"])
  })

  it("keeps local times stable across the spring-forward DST change", () => {
    const sunday: SlotRule = { ...mondayRule, weekday: 0, startTime: "09:00", endTime: "10:00" }
    const slots = generateSlots({
      rules: [sunday],
      busy: [],
      from: new Date("2026-03-01T00:00:00-05:00"),
      to: new Date("2026-03-09T00:00:00-04:00"),
      durationMinutes: 30,
      now: longAgo,
    })
    // 09:00 EST is 14:00Z on Mar 1; 09:00 EDT is 13:00Z on Mar 8.
    expect(iso(slots)).toEqual([
      "2026-03-01T14:00:00.000Z",
      "2026-03-01T14:30:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-08T13:30:00.000Z",
    ])
  })

  it("keeps local times stable across the fall-back DST change", () => {
    const sunday: SlotRule = { ...mondayRule, weekday: 0, startTime: "09:00", endTime: "09:30" }
    const slots = generateSlots({
      rules: [sunday],
      busy: [],
      from: new Date("2026-10-25T00:00:00-04:00"),
      to: new Date("2026-11-02T00:00:00-05:00"),
      durationMinutes: 30,
      now: longAgo,
    })
    expect(iso(slots)).toEqual(["2026-10-25T13:00:00.000Z", "2026-11-01T14:00:00.000Z"])
  })

  it("honours validFrom / validTo", () => {
    const rule = { ...mondayRule, validFrom: "2026-03-10" }
    expect(generateSlots({ rules: [rule], busy: [], ...monday, durationMinutes: 30, now: longAgo })).toEqual([])
  })

  it("merges rules from several clinics in different timezones, sorted by time", () => {
    const chicago: SlotRule = { ...mondayRule, clinicId: "clinic-b", timeZone: "America/Chicago", endTime: "09:30" }
    const ny: SlotRule = { ...mondayRule, endTime: "09:30" }
    const slots = generateSlots({
      rules: [chicago, ny],
      busy: [],
      from: new Date("2026-03-09T00:00:00Z"),
      to: new Date("2026-03-10T12:00:00Z"),
      durationMinutes: 30,
      now: longAgo,
    })
    expect(slots.map((s) => [s.clinicId, s.startsAt.toISOString()])).toEqual([
      ["clinic-a", "2026-03-09T13:00:00.000Z"],
      ["clinic-b", "2026-03-09T14:00:00.000Z"],
    ])
  })
})

describe("isGeneratedSlot", () => {
  const input = { rules: [mondayRule], busy: [], ...monday, durationMinutes: 30, now: longAgo }

  it("accepts a real slot and rejects off-grid or wrong-clinic times", () => {
    expect(isGeneratedSlot(input, clinicId, new Date("2026-03-09T13:30:00Z"))).toBe(true)
    expect(isGeneratedSlot(input, clinicId, new Date("2026-03-09T13:15:00Z"))).toBe(false)
    expect(isGeneratedSlot(input, "other", new Date("2026-03-09T13:30:00Z"))).toBe(false)
  })
})
