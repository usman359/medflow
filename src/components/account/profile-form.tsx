"use client"

import { toast } from "sonner"
import { PatientDetailsForm } from "@/components/booking/patient-details-form"
import type { PatientDetailsInput } from "@/lib/validation/booking"

export function ProfileForm({ defaultValues }: { defaultValues: Partial<PatientDetailsInput> }) {
  return (
    <PatientDetailsForm
      defaultValues={defaultValues}
      submitLabel="Save changes"
      onSaved={() => toast.success("Your details were saved")}
    />
  )
}
