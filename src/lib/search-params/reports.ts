import { createLoader, parseAsString } from "nuqs/server"

export const reportSearchParams = {
  /** First day (YYYY-MM-DD, clinic-local). Defaults to 29 days before `to`. */
  from: parseAsString,
  /** Last day, inclusive. Defaults to today. */
  to: parseAsString,
  clinic: parseAsString,
}

export const loadReportParams = createLoader(reportSearchParams)
