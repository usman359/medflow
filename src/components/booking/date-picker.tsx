"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Calendar } from "@/components/ui/calendar"

function toLocalDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Calendar limited to days with open slots. Dates are clinic-local
 * "YYYY-MM-DD" strings; they're rendered as plain calendar days so the
 * visitor's own timezone never shifts them.
 */
export function BookingDatePicker({
  availableDates,
  selected,
  hrefForDate,
}: {
  availableDates: string[]
  selected: string | null
  /** Pre-built links keyed by date, so the client doesn't re-derive booking URLs. */
  hrefForDate: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const available = new Set(availableDates)
  const first = availableDates[0] ? toLocalDate(availableDates[0]) : new Date()
  const last = availableDates.at(-1) ? toLocalDate(availableDates.at(-1)!) : new Date()

  return (
    <div aria-busy={pending} className={pending ? "opacity-70 transition-opacity" : undefined}>
      <Calendar
        mode="single"
        selected={selected ? toLocalDate(selected) : undefined}
        defaultMonth={selected ? toLocalDate(selected) : first}
        startMonth={first}
        endMonth={last}
        disabled={(day) => !available.has(format(day, "yyyy-MM-dd"))}
        onSelect={(day) => {
          if (!day) return
          const href = hrefForDate[format(day, "yyyy-MM-dd")]
          if (href) startTransition(() => router.push(href, { scroll: false }))
        }}
        className="rounded-2xl border bg-card p-3 [--cell-size:--spacing(10)]"
      />
    </div>
  )
}
