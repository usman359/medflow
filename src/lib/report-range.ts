import { addDays, differenceInCalendarDays, format } from "date-fns"
import { DATE_RE } from "@/lib/search-params/reception"

export const MAX_REPORT_DAYS = 366

const ymd = (d: Date) => format(d, "yyyy-MM-dd")
const parse = (v: string) => {
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Clamps a requested report range to something valid: real dates, ordered, and at most MAX_REPORT_DAYS long. */
export function normalizeRange(from: string | null | undefined, to: string | null | undefined, today: string) {
  const end = to && DATE_RE.test(to) ? to : today
  let start = from && DATE_RE.test(from) ? from : ymd(addDays(parse(end), -29))
  if (start > end) start = end
  if (differenceInCalendarDays(parse(end), parse(start)) + 1 > MAX_REPORT_DAYS) {
    start = ymd(addDays(parse(end), -(MAX_REPORT_DAYS - 1)))
  }
  return { from: start, to: end }
}
