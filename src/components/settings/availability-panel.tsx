"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarOff, Clock, Plus, Trash2 } from "lucide-react"
import { useQueryState } from "nuqs"
import { parseAsString } from "nuqs"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WEEKDAYS } from "@/lib/domain"
import { formatInZone } from "@/lib/format"
import {
  exceptionSchema,
  ruleSchema,
  type ExceptionInput,
  type ExceptionOutput,
  type RuleInput,
  type RuleOutput,
} from "@/lib/validation/settings"
import {
  addAvailabilityExceptionAction,
  addAvailabilityRuleAction,
  deleteAvailabilityExceptionAction,
  deleteAvailabilityRuleAction,
} from "@/server/settings/actions"
import { applyActionError, FormActions, FormDialog } from "./form-kit"

export type AvailabilityDoctor = { id: string; name: string; clinics: { id: string; name: string }[] }
export type RuleRow = {
  id: string
  clinicName: string
  weekday: number
  startTime: string
  endTime: string
  slotMinutes: number
  validFrom: string | null
  validTo: string | null
}
export type ExceptionRow = {
  id: string
  clinicName: string | null
  startsAt: Date
  endsAt: Date
  reason: string | null
  timezone: string
}

/** "09:00:00" → "9:00 AM" */
function time12(value: string) {
  const [h, m] = value.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

const short = (name: string) => name.replace(/^MedFlow\s+/, "")
// Monday first, which is how clinics think about the week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function ConfirmDelete({
  label,
  description,
  onConfirm,
}: {
  label: string
  description: string
  onConfirm: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} disabled={pending}>
          <Trash2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={() => startTransition(onConfirm)}>Yes, remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RuleForm({ doctor, onDone }: { doctor: AvailabilityDoctor; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RuleInput, unknown, RuleOutput>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      doctorId: doctor.id,
      clinicId: doctor.clinics.length === 1 ? doctor.clinics[0].id : "",
      weekday: 1,
      startTime: "09:00",
      endTime: "12:30",
      slotMinutes: 30,
      validFrom: "",
      validTo: "",
    },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors, isSubmitting } = formState

  async function onSubmit() {
    setFormError(null)
    const result = await addAvailabilityRuleAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success("Working hours added")
    router.refresh()
    onDone()
  }

  const input = (
    name: "startTime" | "endTime" | "slotMinutes" | "validFrom" | "validTo",
    label: string,
    type: string,
    hint?: string
  ) => (
    <FormField id={`rule-${name}`} label={label} error={errors[name]?.message as string | undefined} hint={hint}>
      <Input
        id={`rule-${name}`}
        type={type}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(`rule-${name}`, errors[name]?.message as string | undefined, hint)}
        {...register(name)}
      />
    </FormField>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="rule-clinic" label="Clinic" error={errors.clinicId?.message}>
          <Controller
            control={control}
            name="clinicId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="rule-clinic" className="w-full">
                  <SelectValue placeholder="Choose a clinic" />
                </SelectTrigger>
                <SelectContent>
                  {doctor.clinics.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {short(c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id="rule-weekday" label="Day of the week">
          <Controller
            control={control}
            name="weekday"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <SelectTrigger id="rule-weekday" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_ORDER.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {WEEKDAYS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        {input("startTime", "Starts", "time")}
        {input("endTime", "Ends", "time")}
        {input("slotMinutes", "Appointment slot length (minutes)", "number", "How often a new appointment can start.")}
      </div>
      <details className="rounded-xl border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Only for a date range (optional)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {input("validFrom", "From", "date")}
          {input("validTo", "Until", "date")}
        </div>
      </details>
      <FormActions pending={isSubmitting} label="Add hours" />
    </form>
  )
}

function ExceptionForm({ doctor, onDone }: { doctor: AvailabilityDoctor; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ExceptionInput, unknown, ExceptionOutput>({
    resolver: zodResolver(exceptionSchema),
    defaultValues: { doctorId: doctor.id, clinicId: "", startDate: "", endDate: "", reason: "" },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors, isSubmitting } = formState

  async function onSubmit() {
    setFormError(null)
    const result = await addAvailabilityExceptionAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    if (result.data.affected > 0) {
      toast.warning(
        `${result.data.affected} existing appointment${result.data.affected === 1 ? "" : "s"} fall${result.data.affected === 1 ? "s" : ""} in this period. They weren't changed, so please reschedule or cancel them.`,
        { duration: 12000 }
      )
    } else {
      toast.success("Time off added")
    }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="ex-clinic" label="Applies to">
        <Controller
          control={control}
          name="clinicId"
          render={({ field }) => (
            <Select value={field.value || "all"} onValueChange={(v) => field.onChange(v === "all" ? "" : v)}>
              <SelectTrigger id="ex-clinic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All of this doctor&apos;s clinics</SelectItem>
                {doctor.clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {short(c.name)} only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ex-start" label="First day off" error={errors.startDate?.message}>
          <Input id="ex-start" type="date" aria-invalid={!!errors.startDate} {...register("startDate")} />
        </FormField>
        <FormField id="ex-end" label="Last day off" error={errors.endDate?.message}>
          <Input id="ex-end" type="date" aria-invalid={!!errors.endDate} {...register("endDate")} />
        </FormField>
      </div>
      <FormField id="ex-reason" label="Reason (optional)" error={errors.reason?.message}>
        <Input id="ex-reason" placeholder="e.g. Annual leave, conference" {...register("reason")} />
      </FormField>
      <FormActions pending={isSubmitting} label="Add time off" />
    </form>
  )
}

export function AvailabilityPanel({
  doctors,
  selectedId,
  rules,
  exceptions,
}: {
  doctors: AvailabilityDoctor[]
  selectedId: string | null
  rules: RuleRow[]
  exceptions: ExceptionRow[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [, setDoctor] = useQueryState("doctor", parseAsString.withOptions({ shallow: false, startTransition }))
  const doctor = doctors.find((d) => d.id === selectedId) ?? null

  const remove =
    (action: (id: string) => Promise<{ ok: boolean; error?: string }>, id: string, ok: string) => async () => {
      const result = await action(id)
      if (result.ok) toast.success(ok)
      else toast.error(result.error ?? "Something went wrong")
      router.refresh()
    }

  return (
    <section aria-label="Availability" className="grid gap-6">
      <div className="grid max-w-sm gap-2">
        <Label htmlFor="av-doctor">Doctor</Label>
        <Select value={selectedId ?? ""} onValueChange={(v) => setDoctor(v)}>
          <SelectTrigger id="av-doctor" className="w-full">
            <SelectValue placeholder="Choose a doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!doctor ? (
        <p className="text-muted-foreground">Choose a doctor to see and edit their working hours and time off.</p>
      ) : (
        <>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="size-5 text-primary" aria-hidden="true" /> Weekly working hours
              </h3>
              <FormDialog
                title={`Add working hours for ${doctor.name}`}
                description="Patients can book appointments inside these hours. Times are in the clinic's timezone."
                trigger={
                  <Button>
                    <Plus aria-hidden="true" /> Add hours
                  </Button>
                }
              >
                {(close) => <RuleForm doctor={doctor} onDone={close} />}
              </FormDialog>
            </div>
            {rules.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
                No working hours yet, so patients can&apos;t book this doctor online.
              </p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {WEEK_ORDER.map((day) => {
                  const dayRules = rules.filter((r) => r.weekday === day)
                  if (dayRules.length === 0) return null
                  return (
                    <li key={day} className="grid gap-2 p-4 sm:grid-cols-[8rem_1fr]">
                      <h4 className="font-semibold">{WEEKDAYS[day]}</h4>
                      <ul className="grid gap-2">
                        {dayRules.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2"
                          >
                            <span>
                              <span className="font-medium">
                                {time12(r.startTime)} – {time12(r.endTime)}
                              </span>
                              <span className="block text-sm text-muted-foreground">
                                {short(r.clinicName)} · every {r.slotMinutes} min
                                {r.validFrom || r.validTo ? ` · ${r.validFrom ?? "…"} to ${r.validTo ?? "…"}` : ""}
                              </span>
                            </span>
                            <ConfirmDelete
                              label={`Remove ${WEEKDAYS[day]} ${time12(r.startTime)} hours`}
                              description="Patients will no longer be able to book these times. Existing appointments aren't affected."
                              onConfirm={remove(deleteAvailabilityRuleAction, r.id, "Working hours removed")}
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarOff className="size-5 text-primary" aria-hidden="true" /> Time off
              </h3>
              <FormDialog
                title={`Add time off for ${doctor.name}`}
                description="Online booking is blocked for these days. Existing appointments are left alone."
                trigger={
                  <Button variant="outline">
                    <Plus aria-hidden="true" /> Add time off
                  </Button>
                }
              >
                {(close) => <ExceptionForm doctor={doctor} onDone={close} />}
              </FormDialog>
            </div>
            {exceptions.length === 0 ? (
              <p className="text-muted-foreground">No time off scheduled.</p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {exceptions.map((e) => {
                  const first = formatInZone(e.startsAt, e.timezone, "EEE, MMM d, yyyy")
                  const last = formatInZone(new Date(e.endsAt.getTime() - 1), e.timezone, "EEE, MMM d, yyyy")
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 p-3">
                      <span>
                        <span className="font-medium">{first === last ? first : `${first} – ${last}`}</span>
                        <span className="block text-sm text-muted-foreground">
                          {e.clinicName ? short(e.clinicName) : "All clinics"}
                          {e.reason ? ` · ${e.reason}` : ""}
                        </span>
                      </span>
                      <ConfirmDelete
                        label="Remove time off"
                        description="Online booking opens up again for these days."
                        onConfirm={remove(deleteAvailabilityExceptionAction, e.id, "Time off removed")}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
