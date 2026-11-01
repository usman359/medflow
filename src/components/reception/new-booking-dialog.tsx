"use client"

import { Loader2, PhoneCall, Search, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CONSULTATION_LABELS, type ConsultationType } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { StaffBookingOptions } from "@/server/appointments/staff-queries"
import {
  createStaffBookingAction,
  getStaffSlotsAction,
  searchPatientsAction,
  type PatientHit,
} from "@/server/booking/staff-actions"

type Props = { options: StaffBookingOptions; today: string; defaultClinicId?: string }

export function NewBookingDialog(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PhoneCall aria-hidden="true" /> New booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book for a patient</DialogTitle>
          <DialogDescription>
            For phone calls and walk-ins. The appointment is confirmed straight away.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with a clean form and a fresh idempotency key. */}
        <BookingForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

type FieldErrors = Partial<Record<"clinic" | "service" | "doctor" | "date" | "slot" | "patient" | "reason", string>>

function BookingForm({ options, today, defaultClinicId, onDone }: Props & { onDone: () => void }) {
  const router = useRouter()
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const [clinicId, setClinicId] = useState(
    defaultClinicId ?? (options.clinics.length === 1 ? options.clinics[0].id : "")
  )
  const [serviceId, setServiceId] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [type, setType] = useState<ConsultationType>("in_person")
  const [date, setDate] = useState(today)
  const [slot, setSlot] = useState("")
  const [reason, setReason] = useState("Phone booking")
  const [refresh, setRefresh] = useState(0)

  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<{ query: string; patients: PatientHit[] } | null>(null)
  const [patient, setPatient] = useState<PatientHit | null>(null)
  const [np, setNp] = useState({ firstName: "", lastName: "", phone: "", dateOfBirth: "", email: "" })

  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const clinic = options.clinics.find((c) => c.id === clinicId)
  const services = useMemo(() => {
    const map = new Map<string, { id: string; name: string; durationMinutes: number }>()
    for (const d of clinic?.doctors ?? []) for (const s of d.services) map.set(s.id, s)
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [clinic])
  const doctors = (clinic?.doctors ?? []).filter((d) => d.services.some((s) => s.id === serviceId))
  const doctor = doctors.find((d) => d.id === doctorId)
  const tz = clinic?.timezone ?? "America/New_York"

  // Time slots for the chosen doctor/service/day. Loading is derived from the request key (no setState in the effect body).
  const slotKey =
    clinicId && doctorId && serviceId && date ? `${clinicId}|${doctorId}|${serviceId}|${date}|${refresh}` : null
  const [slotResult, setSlotResult] = useState<{ key: string; slots: string[]; error?: string } | null>(null)
  useEffect(() => {
    if (!slotKey) return
    let cancelled = false
    getStaffSlotsAction({ clinicId, doctorId, serviceId, date }).then((res) => {
      if (cancelled) return
      setSlotResult({ key: slotKey, slots: res.ok ? res.data.slots : [], error: res.ok ? undefined : res.error })
    })
    return () => {
      cancelled = true
    }
  }, [slotKey, clinicId, doctorId, serviceId, date])
  const loadingSlots = slotKey !== null && slotResult?.key !== slotKey
  const slots = slotResult?.key === slotKey ? slotResult.slots : []

  // Debounced patient search.
  useEffect(() => {
    const q = query.trim()
    if (patientMode !== "existing" || q.length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchPatientsAction(q).then((res) => {
        if (!cancelled) setHits({ query: q, patients: res.ok ? res.data.patients : [] })
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, patientMode])
  const searching = query.trim().length >= 2 && hits?.query !== query.trim()
  const results = hits?.query === query.trim() ? hits.patients : []

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (!clinicId) e.clinic = "Choose a clinic"
    if (!serviceId) e.service = "Choose a service"
    if (!doctorId) e.doctor = "Choose a doctor"
    if (!date) e.date = "Choose a date"
    if (!slot) e.slot = "Choose a time"
    if (reason.trim().length < 3) e.reason = "Add a short reason"
    if (patientMode === "existing" && !patient) e.patient = "Select a patient, or switch to “New patient”"
    if (patientMode === "new") {
      if (!np.firstName.trim() || !np.lastName.trim()) e.patient = "Enter the patient's first and last name"
      else if (np.phone.trim().length < 7) e.patient = "Enter a phone number we can reach them on"
    }
    return e
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const found = validate()
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const result = await createStaffBookingAction({
        clinicId,
        doctorId,
        serviceId,
        consultationType: type,
        startsAt: slot,
        reason,
        idempotencyKey,
        ...(patientMode === "existing"
          ? { patientId: patient!.id }
          : { newPatient: { ...np, dateOfBirth: np.dateOfBirth || "", email: np.email || "" } }),
      })
      if (result.ok) {
        toast.success(`Booked · reference ${result.data.reference}`)
        router.refresh()
        onDone()
        return
      }
      setFormError(result.error)
      if (result.code === "SLOT_TAKEN" || result.code === "INVALID_SLOT") {
        setSlot("")
        setRefresh((n) => n + 1)
      }
    } catch {
      setFormError("We couldn't reach the server. Check the connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <div aria-live="assertive">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-muted-foreground uppercase">Appointment</legend>
        {options.clinics.length > 1 && (
          <FormField id="nb-clinic" label="Clinic" error={errors.clinic} className="sm:col-span-2">
            <Select
              value={clinicId}
              onValueChange={(v) => {
                setClinicId(v)
                setServiceId("")
                setDoctorId("")
                setSlot("")
              }}
            >
              <SelectTrigger id="nb-clinic" className="w-full">
                <SelectValue placeholder="Choose a clinic" />
              </SelectTrigger>
              <SelectContent>
                {options.clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField id="nb-service" label="Service" error={errors.service}>
          <Select
            value={serviceId}
            disabled={!clinic}
            onValueChange={(v) => {
              setServiceId(v)
              setDoctorId("")
              setSlot("")
            }}
          >
            <SelectTrigger id="nb-service" className="w-full">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.durationMinutes} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="nb-doctor" label="Doctor" error={errors.doctor}>
          <Select
            value={doctorId}
            disabled={!serviceId}
            onValueChange={(v) => {
              setDoctorId(v)
              setSlot("")
              const d = doctors.find((x) => x.id === v)
              if (d && !d.consultationTypes.includes(type)) setType(d.consultationTypes[0])
            }}
          >
            <SelectTrigger id="nb-doctor" className="w-full">
              <SelectValue placeholder={serviceId ? "Choose a doctor" : "Choose a service first"} />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {doctor && doctor.consultationTypes.length > 1 && (
          <FormField id="nb-type" label="Visit type">
            <Select value={type} onValueChange={(v) => setType(v as ConsultationType)}>
              <SelectTrigger id="nb-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doctor.consultationTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CONSULTATION_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField id="nb-date" label="Date" error={errors.date}>
          <Input
            id="nb-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setSlot("")
            }}
          />
        </FormField>

        <div className="sm:col-span-2">
          <p id="nb-slots-label" className="mb-2 text-sm font-medium">
            Time {TIMEZONE_ABBR[tz] ? `(${TIMEZONE_ABBR[tz]})` : ""}
          </p>
          {!slotKey ? (
            <p className="text-sm text-muted-foreground">Choose a service, doctor and date to see open times.</p>
          ) : loadingSlots ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading times…
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {slotResult?.error ?? "No open times on this day. Try another date."}
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="nb-slots-label" className="flex flex-wrap gap-2">
              {slots.map((iso) => {
                const selected = slot === iso
                return (
                  <button
                    key={iso}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSlot(iso)}
                    className={cn(
                      "h-10 min-w-20 rounded-lg border bg-card px-3 text-sm font-semibold text-teal-900 transition hover:border-primary hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {formatInZone(iso, tz, "h:mm a")}
                  </button>
                )
              })}
            </div>
          )}
          {errors.slot && <p className="mt-2 text-sm font-medium text-destructive">{errors.slot}</p>}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Patient</legend>
        <div
          role="tablist"
          aria-label="Patient"
          className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm font-medium"
        >
          {(
            [
              ["existing", "Existing patient", Search],
              ["new", "New patient", UserPlus],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={patientMode === mode}
              onClick={() => setPatientMode(mode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-foreground/70",
                patientMode === mode && "bg-background text-foreground shadow-sm"
              )}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {patientMode === "existing" ? (
          <div className="grid gap-3">
            {patient ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-accent p-3">
                <div>
                  <p className="font-medium">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.phone}
                    {patient.dateOfBirth ? ` · born ${patient.dateOfBirth}` : ""}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPatient(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <FormField id="nb-search" label="Search by name or phone" error={errors.patient}>
                  <Input
                    id="nb-search"
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Rivera or 617 555"
                  />
                </FormField>
                {searching && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching…
                  </p>
                )}
                {results.length > 0 && (
                  <ul className="divide-y rounded-xl border">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPatient(p)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {p.phone}
                            {p.dateOfBirth ? ` · born ${p.dateOfBirth}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No match at your clinics. Switch to “New patient” to add them.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {errors.patient && <p className="text-sm font-medium text-destructive sm:col-span-2">{errors.patient}</p>}
            {(
              [
                ["firstName", "First name", "text", "given-name"],
                ["lastName", "Last name", "text", "family-name"],
                ["phone", "Phone", "tel", "tel"],
                ["dateOfBirth", "Date of birth (optional)", "date", "off"],
              ] as const
            ).map(([key, label, inputType, autoComplete]) => (
              <FormField key={key} id={`np-${key}`} label={label}>
                <Input
                  id={`np-${key}`}
                  type={inputType}
                  autoComplete={autoComplete}
                  value={np[key]}
                  onChange={(e) => setNp((prev) => ({ ...prev, [key]: e.target.value }))}
                  aria-describedby={describedBy(`np-${key}`)}
                />
              </FormField>
            ))}
            <FormField id="np-email" label="Email (optional)" className="sm:col-span-2">
              <Input
                id="np-email"
                type="email"
                autoComplete="off"
                value={np.email}
                onChange={(e) => setNp((prev) => ({ ...prev, email: e.target.value }))}
              />
            </FormField>
          </div>
        )}
      </fieldset>

      <FormField id="nb-reason" label="Reason for visit" error={errors.reason}>
        <Textarea id="nb-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>

      <DialogFooter>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {submitting ? "Booking…" : "Confirm booking"}
        </Button>
      </DialogFooter>
    </form>
  )
}
