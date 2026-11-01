import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Formats an instant in a clinic's timezone (date-fns pattern). */
export function formatInZone(date: Date | string, timeZone: string, pattern: string): string {
  return format(new TZDate(new Date(date), timeZone), pattern)
}

export const TIMEZONE_ABBR: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
}

/** True once `date` is behind the current time. Server pages are rendered per request, so "now" is fresh. */
export function hasPassed(date: Date): boolean {
  return date.getTime() <= Date.now()
}

/** The current instant. Server pages render per request, so this is always fresh. */
export function currentTime(): Date {
  return new Date()
}
