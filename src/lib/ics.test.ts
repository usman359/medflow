import { describe, expect, it } from "vitest"
import { buildIcs } from "./ics"

const event = {
  uid: "abc@medflow",
  start: new Date("2026-10-08T14:30:00Z"),
  end: new Date("2026-10-08T15:00:00Z"),
  title: "Cardiology consultation with Dr. Morales",
  now: new Date("2026-10-07T12:00:00Z"),
}

describe("buildIcs", () => {
  it("produces a valid single-event calendar with UTC timestamps and CRLF line endings", () => {
    const ics = buildIcs(event)
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(ics).toContain("DTSTART:20261008T143000Z")
    expect(ics).toContain("DTEND:20261008T150000Z")
    expect(ics).toContain("DTSTAMP:20261007T120000Z")
    expect(ics).toContain("UID:abc@medflow")
    // Every line break is CRLF; there are no bare LFs.
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/)
  })

  it("escapes commas, semicolons, backslashes and newlines in text fields", () => {
    const ics = buildIcs({
      ...event,
      description: "Bring ID; arrive early, please\\thanks\nSee you",
      location: "Suite 6, 455 Lexington Ave",
    })
    expect(ics).toContain("DESCRIPTION:Bring ID\\; arrive early\\, please\\\\thanks\\nSee you")
    expect(ics).toContain("LOCATION:Suite 6\\, 455 Lexington Ave")
  })

  it("folds long lines at 75 characters", () => {
    const ics = buildIcs({ ...event, description: "word ".repeat(60) })
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75)
    expect(ics).toMatch(/\r\n [a-z]/) // continuation lines start with a space
  })

  it("includes a one-hour reminder", () => {
    expect(buildIcs(event)).toContain("TRIGGER:-PT1H")
  })
})
