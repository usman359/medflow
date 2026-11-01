import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server"
import { APPOINTMENT_STATUSES } from "@/lib/domain"

/** Reception dashboard filters. Everything lives in the URL so views can be shared and survive refreshes. */
export const receptionSearchParams = {
  /** Clinic-local calendar day, YYYY-MM-DD. Null means "today" at each clinic. */
  date: parseAsString,
  clinic: parseAsString,
  doctor: parseAsString,
  status: parseAsStringLiteral(APPOINTMENT_STATUSES),
  q: parseAsString.withDefault(""),
}

export const loadReceptionSearchParams = createLoader(receptionSearchParams)

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
