import { TZDate } from "@date-fns/tz"
import { DATE_RE } from "@/lib/search-params/reception"

/** Parses "YYYY-MM-DD" into [year, zero-based month, day], or null if it isn't one. */
export function parseYmd(date: string): [number, number, number] | null {
  if (!DATE_RE.test(date)) return null
  const [y, m, d] = date.split("-").map(Number)
  return [y, m - 1, d]
}

/**
 * [start, end) of a clinic-local calendar day as absolute instants. `date` null means today at that clinic.
 * Computed in the clinic's timezone, so the range is 23 or 25 hours long on daylight-saving days.
 */
export function clinicDayRange(timezone: string, date: string | null | undefined, now = new Date()) {
  const ymd =
    (date && parseYmd(date)) ||
    (() => {
      const t = new TZDate(now, timezone)
      return [t.getFullYear(), t.getMonth(), t.getDate()] as [number, number, number]
    })()
  const start = new TZDate(ymd[0], ymd[1], ymd[2], timezone)
  const end = new TZDate(ymd[0], ymd[1], ymd[2] + 1, timezone)
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) }
}
