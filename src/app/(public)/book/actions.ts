"use server"

import { revalidatePath } from "next/cache"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { createBookingSchema, patientDetailsSchema } from "@/lib/validation/booking"
import { requireRole } from "@/server/auth"
import type { Slot } from "@/server/availability/slots"
import { createBooking } from "@/server/booking/create-booking"
import { getPatientForUser, isPatientProfileComplete, upsertPatientForUser } from "@/server/patients/queries"

export async function savePatientDetailsAction(input: unknown): Promise<ActionResult> {
  const user = await requireRole("patient")
  const parsed = patientDetailsSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)

  await upsertPatientForUser(user.id, user.email, parsed.data)
  revalidatePath("/account", "layout")
  return { ok: true, data: undefined }
}

export async function createBookingAction(
  input: unknown
): Promise<ActionResult<{ id: string; reference: string }, { alternatives?: Slot[] }>> {
  const user = await requireRole("patient")
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)

  const patient = await getPatientForUser(user.id)
  if (!patient || !isPatientProfileComplete(patient)) {
    return { ok: false, code: "DETAILS_REQUIRED", error: "Please add your details before booking." }
  }

  const result = await createBooking({
    ...parsed.data,
    startsAt: new Date(parsed.data.startsAt),
    patientId: patient.id,
    source: "online",
    actor: { id: user.id, role: user.role },
  })
  if (!result.ok) {
    const { error } = result
    return {
      ok: false,
      code: error.code,
      error: error.message,
      details: "alternatives" in error ? { alternatives: error.alternatives } : undefined,
    }
  }

  revalidatePath("/account", "layout")
  revalidatePath("/staff", "layout")
  return { ok: true, data: { id: result.appointment.id, reference: result.appointment.reference } }
}
