import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server"
import { CONSULTATION_TYPES } from "@/lib/domain"

/** Booking stepper state lives in the URL so it survives refreshes and can be deep-linked. */
export const BOOKING_STEPS = ["service", "doctor", "clinic", "time", "details", "review"] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

export const BOOKING_STEP_LABELS: Record<BookingStep, string> = {
  service: "Service",
  doctor: "Doctor",
  clinic: "Location",
  time: "Date & time",
  details: "Your details",
  review: "Review",
}

export const bookingSearchParams = {
  step: parseAsStringLiteral(BOOKING_STEPS),
  specialty: parseAsString,
  service: parseAsString,
  doctor: parseAsString,
  clinic: parseAsString,
  type: parseAsStringLiteral(CONSULTATION_TYPES),
  /** Clinic-local calendar date, YYYY-MM-DD */
  date: parseAsString,
  /** Slot start as an ISO instant */
  slot: parseAsString,
}

export type BookingParams = {
  [K in keyof typeof bookingSearchParams]: string | null
} & { step: BookingStep | null; type: (typeof CONSULTATION_TYPES)[number] | null }

export const loadBookingParams = createLoader(bookingSearchParams)
const serialize = createSerializer(bookingSearchParams)

/** Choosing something invalidates every choice that depended on it. */
const CLEARS: Partial<Record<keyof BookingParams, (keyof BookingParams)[]>> = {
  specialty: ["slot", "date"],
  service: ["slot", "date"],
  doctor: ["clinic", "type", "slot", "date"],
  clinic: ["slot", "date"],
  type: ["slot"],
  date: ["slot"],
}

/**
 * Builds a /book URL from the current params plus changes. Unless `step` is
 * given explicitly, it is dropped so the page advances to the first
 * incomplete step.
 */
export function bookingHref(current: BookingParams, changes: Partial<BookingParams>): string {
  const next: BookingParams = { ...current, step: null }
  for (const key of Object.keys(changes) as (keyof BookingParams)[]) {
    for (const cleared of CLEARS[key] ?? []) (next as Record<string, unknown>)[cleared] = null
  }
  Object.assign(next, changes)
  return serialize("/book", next)
}
