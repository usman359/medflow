"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { savePatientDetailsAction } from "@/app/(public)/book/actions"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { patientDetailsSchema, type PatientDetailsInput } from "@/lib/validation/booking"

const FIELDS = [
  { name: "firstName", label: "First name", type: "text", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", type: "text", autoComplete: "family-name" },
  { name: "dateOfBirth", label: "Date of birth", type: "date", autoComplete: "bday" },
  {
    name: "phone",
    label: "Mobile number",
    type: "tel",
    autoComplete: "tel",
    hint: "The clinic will call this number if anything changes.",
  },
] as const

export function PatientDetailsForm({
  defaultValues,
  continueHref,
  submitLabel = "Continue",
  onSaved,
}: {
  defaultValues: Partial<PatientDetailsInput>
  continueHref?: string
  submitLabel?: string
  onSaved?: () => void
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientDetailsInput>({
    resolver: zodResolver(patientDetailsSchema),
    defaultValues: { firstName: "", lastName: "", dateOfBirth: "", phone: "", ...defaultValues },
  })

  async function onSubmit(values: PatientDetailsInput) {
    setFormError(null)
    const result = await savePatientDetailsAction(values)
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof PatientDetailsInput, { message: messages[0] })
      }
      setFormError(result.error)
      return
    }
    onSaved?.()
    if (continueHref) router.push(continueHref, { scroll: false })
    else router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div aria-live="polite">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const error = errors[field.name]?.message
          const hint = "hint" in field ? field.hint : undefined
          return (
            <FormField key={field.name} id={field.name} label={field.label} error={error} hint={hint}>
              <Input
                id={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                aria-invalid={!!error}
                aria-describedby={describedBy(field.name, error, hint)}
                {...register(field.name)}
              />
            </FormField>
          )
        })}
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}
