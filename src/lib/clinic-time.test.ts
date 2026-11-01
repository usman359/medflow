import { describe, expect, it } from "vitest"
import { clinicDayRange, parseYmd } from "./clinic-time"
import { MAX_REPORT_DAYS, normalizeRange } from "./report-range"

const hours = (r: { start: Date; end: Date }) => (r.end.getTime() - r.start.getTime()) / 3_600_000

describe("clinicDayRange", () => {
  it("starts and ends at local midnight in the clinic's timezone", () => {
    const r = clinicDayRange("America/New_York", "2026-10-05")
    expect(r.start.toISOString()).toBe("2026-10-05T04:00:00.000Z") // EDT is UTC-4
    expect(r.end.toISOString()).toBe("2026-10-06T04:00:00.000Z")
  })

  it("is 23 hours on spring-forward and 25 on fall-back days", () => {
    expect(hours(clinicDayRange("America/New_York", "2026-03-08"))).toBe(23)
    expect(hours(clinicDayRange("America/New_York", "2026-11-01"))).toBe(25)
    expect(hours(clinicDayRange("America/Chicago", "2026-06-15"))).toBe(24)
  })

  it("gives the same calendar day a different instant in different clinics", () => {
    const ny = clinicDayRange("America/New_York", "2026-10-05").start.getTime()
    const chi = clinicDayRange("America/Chicago", "2026-10-05").start.getTime()
    expect(chi - ny).toBe(3_600_000)
  })

  it("uses 'today' at the clinic when no date is given", () => {
    // 02:00 UTC on Oct 6 is still the evening of Oct 5 in Chicago.
    const r = clinicDayRange("America/Chicago", null, new Date("2026-10-06T02:00:00Z"))
    expect(r.start.toISOString()).toBe("2026-10-05T05:00:00.000Z")
  })

  it("ignores malformed dates (falls back to today)", () => {
    const now = new Date("2026-10-06T15:00:00Z")
    expect(clinicDayRange("America/New_York", "garbage", now)).toEqual(clinicDayRange("America/New_York", null, now))
    expect(parseYmd("2026-13-40")).toEqual([2026, 12, 40]) // shape-checked only; callers validate real dates
    expect(parseYmd("10/05/2026")).toBeNull()
  })
})

describe("normalizeRange", () => {
  it("defaults to the last 30 days ending today", () => {
    expect(normalizeRange(null, null, "2026-10-07")).toEqual({ from: "2026-09-08", to: "2026-10-07" })
  })

  it("keeps a valid range as given", () => {
    expect(normalizeRange("2026-09-01", "2026-09-30", "2026-10-07")).toEqual({ from: "2026-09-01", to: "2026-09-30" })
  })

  it("repairs reversed and malformed input", () => {
    expect(normalizeRange("2026-10-10", "2026-10-01", "2026-10-07")).toEqual({ from: "2026-10-01", to: "2026-10-01" })
    expect(normalizeRange("nope", "2026-10-07", "2026-10-07")).toEqual({ from: "2026-09-08", to: "2026-10-07" })
  })

  it("caps the range length", () => {
    const r = normalizeRange("2020-01-01", "2026-10-07", "2026-10-07")
    expect(r.to).toBe("2026-10-07")
    const days = (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 + 1
    expect(days).toBe(MAX_REPORT_DAYS)
  })
})
