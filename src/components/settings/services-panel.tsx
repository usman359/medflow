"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDuration, formatPrice } from "@/lib/format"
import { serviceSchema, type ServiceInput, type ServiceOutput } from "@/lib/validation/settings"
import { saveServiceAction } from "@/server/settings/actions"
import { applyActionError, FormActions, FormDialog, SwitchField } from "./form-kit"

export type ServiceRow = {
  id: string
  name: string
  description: string
  specialtyId: string
  durationMinutes: number
  priceCents: number
  isActive: boolean
}

function ServiceForm({
  service,
  specialties,
  onDone,
}: {
  service?: ServiceRow
  specialties: { id: string; name: string }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ServiceInput, unknown, ServiceOutput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      id: service?.id,
      name: service?.name ?? "",
      description: service?.description ?? "",
      specialtyId: service?.specialtyId ?? "",
      durationMinutes: service?.durationMinutes ?? 30,
      price: service ? service.priceCents / 100 : 0,
      isActive: service?.isActive ?? true,
    },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors, isSubmitting } = formState

  async function onSubmit() {
    setFormError(null)
    const result = await saveServiceAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success(service ? "Service updated" : "Service added")
    router.refresh()
    onDone()
  }

  const num = (name: "durationMinutes" | "price", label: string, hint?: string, step?: string) => (
    <FormField id={`svc-${name}`} label={label} error={errors[name]?.message as string | undefined} hint={hint}>
      <Input
        id={`svc-${name}`}
        type="number"
        step={step}
        inputMode="decimal"
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(`svc-${name}`, errors[name]?.message as string | undefined, hint)}
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
      <FormField id="svc-name" label="Name" error={errors.name?.message}>
        <Input id="svc-name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField id="svc-description" label="Description" error={errors.description?.message}>
        <Textarea id="svc-description" rows={2} aria-invalid={!!errors.description} {...register("description")} />
      </FormField>
      <FormField id="svc-specialty" label="Specialty" error={errors.specialtyId?.message}>
        <Controller
          control={control}
          name="specialtyId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="svc-specialty" className="w-full">
                <SelectValue placeholder="Choose a specialty" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {num("durationMinutes", "Duration (minutes)", "Also the length of the booked time slot.")}
        {num("price", "Self-pay price (USD)", undefined, "0.01")}
      </div>
      {service && (
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <SwitchField
              id="svc-active"
              label="Available to book"
              description="Turn off to hide it from the booking flow. Existing appointments aren't affected."
              checked={!!field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
      <FormActions pending={isSubmitting} label={service ? "Save changes" : "Add service"} />
    </form>
  )
}

export function ServicesPanel({
  services,
  specialties,
}: {
  services: ServiceRow[]
  specialties: { id: string; name: string }[]
}) {
  return (
    <section aria-label="Services" className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Services are shared by every clinic, so a change here (especially price and duration) applies group-wide.
        </p>
        <FormDialog
          title="Add a service"
          trigger={
            <Button>
              <Plus aria-hidden="true" /> Add service
            </Button>
          }
        >
          {(close) => <ServiceForm specialties={specialties} onDone={close} />}
        </FormDialog>
      </div>
      {specialties.map((sp) => {
        const rows = services.filter((s) => s.specialtyId === sp.id)
        if (rows.length === 0) return null
        return (
          <div key={sp.id} className="grid gap-2">
            <h3 className="font-semibold">{sp.name}</h3>
            <ul className="divide-y rounded-2xl border bg-card">
              {rows.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {s.name}
                      {!s.isActive && <Badge variant="outline">Hidden</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                    </p>
                  </div>
                  <FormDialog
                    title={`Edit ${s.name}`}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {s.name}</span>
                      </Button>
                    }
                  >
                    {(close) => <ServiceForm service={s} specialties={specialties} onDone={close} />}
                  </FormDialog>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
