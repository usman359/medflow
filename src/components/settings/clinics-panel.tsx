"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Clock, MapPin, Pencil, Phone, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { TIMEZONE_ABBR } from "@/lib/format"
import { CLINIC_TIMEZONES, clinicSchema, type ClinicInput, type ClinicOutput } from "@/lib/validation/settings"
import { saveClinicAction, setAutoConfirmAction } from "@/server/settings/actions"
import { applyActionError, FormActions, FormDialog, SwitchField } from "./form-kit"

export type ClinicRow = {
  id: string
  name: string
  addressLine: string
  city: string
  phone: string
  email: string | null
  timezone: string
  openingHours: string | null
  photoUrl: string | null
  autoConfirmOnline: boolean
  isActive: boolean
}

function ClinicForm({ clinic, onDone }: { clinic?: ClinicRow; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ClinicInput, unknown, ClinicOutput>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      id: clinic?.id,
      name: clinic?.name ?? "",
      addressLine: clinic?.addressLine ?? "",
      city: clinic?.city ?? "",
      phone: clinic?.phone ?? "",
      email: clinic?.email ?? "",
      timezone: (clinic?.timezone as ClinicInput["timezone"]) ?? "America/New_York",
      openingHours: clinic?.openingHours ?? "",
      photoUrl: clinic?.photoUrl ?? "",
      autoConfirmOnline: clinic?.autoConfirmOnline ?? false,
      isActive: clinic?.isActive ?? true,
    },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors, isSubmitting } = formState

  const text = (
    name: keyof ClinicInput,
    label: string,
    extra?: { type?: string; hint?: string; className?: string }
  ) => (
    <FormField
      id={`clinic-${name}`}
      label={label}
      error={errors[name]?.message as string | undefined}
      hint={extra?.hint}
      className={extra?.className}
    >
      <Input
        id={`clinic-${name}`}
        type={extra?.type ?? "text"}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(`clinic-${name}`, errors[name]?.message as string | undefined, extra?.hint)}
        {...register(name as "name")}
      />
    </FormField>
  )

  async function onSubmit() {
    setFormError(null)
    const result = await saveClinicAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success(clinic ? "Clinic updated" : "Clinic added")
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
      {text("name", "Clinic name")}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("addressLine", "Street address")}
        {text("city", "City and state")}
        {text("phone", "Phone", { type: "tel" })}
        {text("email", "Email (optional)", { type: "email" })}
      </div>
      <FormField id="clinic-timezone" label="Timezone" hint="Appointment times are shown in this timezone.">
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="clinic-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLINIC_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace("America/", "").replace("_", " ")} ({TIMEZONE_ABBR[tz]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      {text("openingHours", "Opening hours (optional)", { hint: "Shown on the public site, e.g. Mon–Fri 8:30–17:30" })}
      {text("photoUrl", "Photo web address (optional)", { type: "url" })}
      <Controller
        control={control}
        name="autoConfirmOnline"
        render={({ field }) => (
          <SwitchField
            id="clinic-auto"
            label="Confirm online bookings automatically"
            description="Off: new online bookings wait as “Requested” until reception confirms them."
            checked={!!field.value}
            onChange={field.onChange}
          />
        )}
      />
      {clinic && (
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <SwitchField
              id="clinic-active"
              label="Open for online booking"
              description="Turn off to hide this clinic from patients. Not allowed while it has upcoming appointments."
              checked={!!field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
      <FormActions pending={isSubmitting} label={clinic ? "Save changes" : "Add clinic"} />
    </form>
  )
}

function AutoConfirmToggle({ clinic }: { clinic: ClinicRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checked, setChecked] = useState(clinic.autoConfirmOnline)

  function change(value: boolean) {
    setChecked(value)
    startTransition(async () => {
      const result = await setAutoConfirmAction({ clinicId: clinic.id, value })
      if (result.ok) {
        toast.success(
          value ? "Online bookings now confirm automatically" : "Online bookings now need reception to confirm"
        )
        router.refresh()
      } else {
        setChecked(!value)
        toast.error(result.error)
      }
    })
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
      <span>
        <span className="font-medium">Auto-confirm online bookings</span>
        <span className="block text-muted-foreground">
          {checked ? "Patients are confirmed instantly" : "Reception confirms each request"}
        </span>
      </span>
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={change}
        aria-label={`Auto-confirm online bookings at ${clinic.name}`}
      />
    </label>
  )
}

export function ClinicsPanel({ clinics, canCreate }: { clinics: ClinicRow[]; canCreate: boolean }) {
  return (
    <section aria-label="Clinics" className="grid gap-4">
      {canCreate && (
        <div className="flex justify-end">
          <FormDialog
            title="Add a clinic"
            description="New clinics are open for booking once you add doctors and their working hours."
            trigger={
              <Button>
                <Plus aria-hidden="true" /> Add clinic
              </Button>
            }
          >
            {(close) => <ClinicForm onDone={close} />}
          </FormDialog>
        </div>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {clinics.map((c) => (
          <li key={c.id} className="grid content-start gap-4 rounded-3xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {c.name}
                  {!c.isActive && <Badge variant="outline">Closed to booking</Badge>}
                </h3>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {c.addressLine}, {c.city}
                </p>
              </div>
              <FormDialog
                title={`Edit ${c.name}`}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {c.name}</span>
                  </Button>
                }
              >
                {(close) => <ClinicForm clinic={c} onDone={close} />}
              </FormDialog>
            </div>
            <ul className="grid gap-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden="true" /> {c.phone}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" /> {c.openingHours ?? "No hours listed"} ·{" "}
                {TIMEZONE_ABBR[c.timezone] ?? c.timezone}
              </li>
            </ul>
            <AutoConfirmToggle clinic={c} />
          </li>
        ))}
      </ul>
    </section>
  )
}
