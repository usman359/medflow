"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, UserRoundCheck } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CONSULTATION_LABELS, CONSULTATION_TYPES } from "@/lib/domain"
import { doctorSchema, type DoctorInput, type DoctorOutput } from "@/lib/validation/settings"
import { saveDoctorAction } from "@/server/settings/actions"
import type { ManagedDoctor } from "@/server/settings/queries"
import { applyActionError, CheckboxGroup, FormActions, FormDialog, SwitchField } from "./form-kit"

type Option = { value: string; label: string; hint?: string }
type ServiceOption = Option & { specialtyId: string }

type Catalog = {
  clinics: Option[]
  specialties: Option[]
  services: ServiceOption[]
  /** Clinic ids the signed-in user manages; others are shown but locked. */
  managedClinicIds: string[]
}

function DoctorForm({ doctor, catalog, onDone }: { doctor?: ManagedDoctor; catalog: Catalog; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<DoctorInput, unknown, DoctorOutput>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      id: doctor?.id,
      name: doctor?.name ?? "",
      title: doctor?.title ?? "",
      bio: doctor?.bio ?? "",
      photoUrl: doctor?.photoUrl ?? "",
      yearsExperience: doctor?.yearsExperience ?? 0,
      languages: doctor?.languages.join(", ") ?? "English",
      consultationTypes: doctor?.consultationTypes ?? ["in_person"],
      isActive: doctor?.isActive ?? true,
      clinicIds: doctor?.clinicIds ?? (catalog.managedClinicIds.length === 1 ? catalog.managedClinicIds : []),
      specialtyIds: doctor?.specialtyIds ?? [],
      serviceIds: doctor?.serviceIds ?? [],
    },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors, isSubmitting } = formState
  const specialtyIds = useWatch({ control, name: "specialtyIds" })
  const selectedServiceIds = useWatch({ control, name: "serviceIds" })

  // Show only services that belong to the chosen specialties, to keep a long list manageable.
  // (Already-selected services stay visible so nothing is hidden while checked.)
  const services = catalog.services.filter(
    (s) => !specialtyIds.length || specialtyIds.includes(s.specialtyId) || selectedServiceIds.includes(s.value)
  )

  const field = (
    name: keyof DoctorInput,
    label: string,
    extra?: { type?: string; hint?: string; className?: string }
  ) => (
    <FormField
      id={`doc-${name}`}
      label={label}
      error={errors[name]?.message as string | undefined}
      hint={extra?.hint}
      className={extra?.className}
    >
      <Input
        id={`doc-${name}`}
        type={extra?.type ?? "text"}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(`doc-${name}`, errors[name]?.message as string | undefined, extra?.hint)}
        {...register(name as "name")}
      />
    </FormField>
  )

  async function onSubmit() {
    setFormError(null)
    const result = await saveDoctorAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success(doctor ? "Doctor updated" : "Doctor added")
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Name", { hint: "e.g. Dr. Maria Lopez" })}
        {field("title", "Title", { hint: "e.g. Cardiologist" })}
        {field("yearsExperience", "Years of experience", { type: "number" })}
        {field("languages", "Languages", { hint: "Separate with commas" })}
      </div>
      <FormField id="doc-bio" label="Bio" error={errors.bio?.message}>
        <Textarea id="doc-bio" rows={4} aria-invalid={!!errors.bio} {...register("bio")} />
      </FormField>
      {field("photoUrl", "Portrait web address (optional)", { type: "url" })}

      <Controller
        control={control}
        name="consultationTypes"
        render={({ field: f }) => (
          <CheckboxGroup
            legend="Visit types"
            options={CONSULTATION_TYPES.map((t) => ({ value: t, label: CONSULTATION_LABELS[t] }))}
            value={f.value}
            onChange={f.onChange}
            error={errors.consultationTypes?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="clinicIds"
        render={({ field: f }) => (
          <CheckboxGroup
            legend="Clinics"
            hint={
              catalog.managedClinicIds.length < catalog.clinics.length
                ? "Clinics you don't manage are shown locked."
                : undefined
            }
            options={catalog.clinics}
            value={f.value}
            onChange={f.onChange}
            disabledValues={catalog.clinics.map((c) => c.value).filter((v) => !catalog.managedClinicIds.includes(v))}
            error={errors.clinicIds?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="specialtyIds"
        render={({ field: f }) => (
          <CheckboxGroup
            legend="Specialties"
            options={catalog.specialties}
            value={f.value}
            onChange={f.onChange}
            error={errors.specialtyIds?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="serviceIds"
        render={({ field: f }) => (
          <CheckboxGroup
            legend="Services offered"
            hint={
              specialtyIds.length
                ? "Showing services for the selected specialties."
                : "Choose a specialty to see its services."
            }
            options={services}
            value={f.value}
            onChange={f.onChange}
            error={errors.serviceIds?.message}
          />
        )}
      />
      {doctor && (
        <Controller
          control={control}
          name="isActive"
          render={({ field: f }) => (
            <SwitchField
              id="doc-active"
              label="Accepting online bookings"
              description="Turn off to hide this doctor from patients. Not allowed while they have upcoming appointments."
              checked={!!f.value}
              onChange={f.onChange}
            />
          )}
        />
      )}
      <FormActions pending={isSubmitting} label={doctor ? "Save changes" : "Add doctor"} />
    </form>
  )
}

export function DoctorsPanel({
  doctors,
  catalog,
  clinicNames,
  specialtyNames,
}: {
  doctors: ManagedDoctor[]
  catalog: Catalog
  clinicNames: Record<string, string>
  specialtyNames: Record<string, string>
}) {
  return (
    <section aria-label="Doctors" className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Profiles, clinics and services. Working hours are under{" "}
          <span className="font-medium text-foreground">Availability</span>. Linking a doctor to their login is done by
          a system administrator under Users &amp; roles.
        </p>
        <FormDialog
          wide
          title="Add a doctor"
          description="They become bookable once you set their working hours."
          trigger={
            <Button>
              <Plus aria-hidden="true" /> Add doctor
            </Button>
          }
        >
          {(close) => <DoctorForm catalog={catalog} onDone={close} />}
        </FormDialog>
      </div>
      <ul className="divide-y rounded-2xl border bg-card">
        {doctors.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-mint">
              {d.photoUrl && <Image src={d.photoUrl} alt="" fill sizes="56px" className="object-cover object-top" />}
            </div>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {d.name}
                {!d.isActive && <Badge variant="outline">Hidden</Badge>}
                {d.hasAccount && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <UserRoundCheck className="size-3.5" aria-hidden="true" /> Has login
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {d.title} ·{" "}
                {d.specialtyIds
                  .map((id) => specialtyNames[id])
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {d.clinicIds
                  .map((id) => clinicNames[id]?.replace(/^MedFlow\s+/, ""))
                  .filter(Boolean)
                  .join(" · ") || "No clinic assigned"}
              </p>
            </div>
            <FormDialog
              wide
              title={`Edit ${d.name}`}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {d.name}</span>
                </Button>
              }
            >
              {(close) => <DoctorForm doctor={d} catalog={catalog} onDone={close} />}
            </FormDialog>
          </li>
        ))}
      </ul>
    </section>
  )
}
