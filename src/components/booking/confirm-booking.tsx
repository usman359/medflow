"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { createBookingAction } from "@/app/(public)/book/actions"
import { FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ConsultationType } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"

type Alternative = { iso: string; href: string }

/**
 * One idempotency key per booking attempt, kept in sessionStorage so a
 * refresh, double click or network retry re-sends the same key and the server
 * returns the original appointment instead of creating a second one.
 */
function useIdempotencyKey(scope: string) {
  const ref = useRef<string | null>(null)
  const storageKey = `medflow:booking-key:${scope}`
  const get = () => {
    if (ref.current) return ref.current
    let key: string | null = null
    try {
      key = sessionStorage.getItem(storageKey)
    } catch {}
    if (!key) {
      key = crypto.randomUUID()
      try {
        sessionStorage.setItem(storageKey, key)
      } catch {}
    }
    ref.current = key
    return key
  }
  const clear = () => {
    ref.current = null
    try {
      sessionStorage.removeItem(storageKey)
    } catch {}
  }
  return { get, clear }
}

export function ConfirmBooking({
  booking,
  timezone,
  alternativeHref,
  detailsHref,
}: {
  booking: {
    doctorId: string
    clinicId: string
    serviceId: string
    consultationType: ConsultationType
    startsAt: string
  }
  timezone: string
  /** Base URL for picking an alternative slot; `slot` is appended. */
  alternativeHref: string
  detailsHref: string
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string; alternatives?: Alternative[] } | null>(null)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const key = useIdempotencyKey(`${booking.doctorId}|${booking.clinicId}|${booking.serviceId}|${booking.startsAt}`)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setReasonError(null)
    if (reason.trim().length < 3) {
      setReasonError("Tell the doctor briefly why you're coming in")
      return
    }
    setSubmitting(true)
    try {
      const result = await createBookingAction({ ...booking, reason, idempotencyKey: key.get() })
      if (result.ok) {
        key.clear()
        router.push(`/book/confirmed/${result.data.id}`)
        return
      }
      if (result.fieldErrors?.reason) setReasonError(result.fieldErrors.reason[0])
      setError({
        message: result.error,
        code: result.code,
        alternatives: result.details?.alternatives?.map((s) => {
          const iso = new Date(s.startsAt).toISOString()
          return { iso, href: `${alternativeHref}&slot=${encodeURIComponent(iso)}` }
        }),
      })
      setSubmitting(false)
    } catch {
      // Network failure: keep the key, so trying again can't double-book.
      setError({ message: "We couldn't reach the server. Check your connection and try again." })
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <FormField
        id="reason"
        label="Reason for your visit"
        error={reasonError ?? undefined}
        hint="A sentence is enough. Only your care team can see this."
      >
        <Textarea
          id="reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={!!reasonError}
          aria-describedby={reasonError ? "reason-error" : "reason-hint"}
          placeholder="e.g. Knee pain after running for the last two weeks"
        />
      </FormField>

      <div aria-live="assertive">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>
              {error.code === "SLOT_TAKEN" ? "That time was just taken" : "We couldn't book this appointment"}
            </AlertTitle>
            <AlertDescription className="grid gap-3">
              <p>{error.message}</p>
              {error.alternatives && error.alternatives.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {error.alternatives.map((alt) => (
                    <li key={alt.iso}>
                      <Button asChild size="sm" variant="outline">
                        <Link href={alt.href} scroll={false}>
                          {formatInZone(alt.iso, timezone, "EEE MMM d, h:mm a")} {TIMEZONE_ABBR[timezone] ?? ""}
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {error.code === "PATIENT_CONFLICT" && (
                <Link href="/account/appointments" className="font-medium underline">
                  View my appointments
                </Link>
              )}
              {error.code === "DETAILS_REQUIRED" && (
                <Link href={detailsHref} className="font-medium underline">
                  Add my details
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        By confirming you agree to arrive 10 minutes early. You can cancel online up until the appointment starts.
      </p>
      <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={submitting} aria-disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  )
}
