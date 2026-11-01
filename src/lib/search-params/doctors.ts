import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server"
import { CONSULTATION_TYPES } from "@/lib/domain"

/** Doctor directory filters, shared by the server page (loader) and the client filter bar. */
export const doctorSearchParams = {
  q: parseAsString.withDefault(""),
  specialty: parseAsString,
  clinic: parseAsString,
  type: parseAsStringLiteral(CONSULTATION_TYPES),
}

export const loadDoctorSearchParams = createLoader(doctorSearchParams)
