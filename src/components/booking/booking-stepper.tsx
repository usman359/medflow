import { Check } from "lucide-react"
import Link from "next/link"
import {
  BOOKING_STEP_LABELS,
  BOOKING_STEPS,
  bookingHref,
  type BookingParams,
  type BookingStep,
} from "@/lib/search-params/booking"
import { cn } from "@/lib/utils"

export function BookingStepper({
  params,
  step,
  firstIncomplete,
}: {
  params: BookingParams
  step: BookingStep
  firstIncomplete: BookingStep
}) {
  const current = BOOKING_STEPS.indexOf(step)
  const reachable = BOOKING_STEPS.indexOf(firstIncomplete)

  return (
    <nav aria-label="Booking progress">
      <p className="mb-2 text-sm font-medium text-muted-foreground sm:hidden">
        Step {current + 1} of {BOOKING_STEPS.length} · {BOOKING_STEP_LABELS[step]}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted sm:hidden" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((current + 1) / BOOKING_STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="hidden gap-2 sm:grid sm:grid-cols-6">
        {BOOKING_STEPS.map((s, i) => {
          const done = i < reachable && s !== step
          const isCurrent = s === step
          const content = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-background text-primary ring-2 ring-primary/25"
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className="truncate">{BOOKING_STEP_LABELS[s]}</span>
            </>
          )
          const base = "flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium"
          return (
            <li key={s} className="min-w-0">
              {i <= reachable && !isCurrent ? (
                <Link
                  href={bookingHref(params, { step: s })}
                  scroll={false}
                  className={cn(base, "text-foreground hover:bg-accent")}
                >
                  {content}
                  {done && <span className="sr-only">(completed, change)</span>}
                </Link>
              ) : (
                <span
                  className={cn(base, isCurrent ? "text-teal-900" : "text-muted-foreground")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
