"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { APPOINTMENT_STATUSES } from "@/lib/domain"
import { requireUser } from "@/server/auth"
import { transitionAppointment } from "./transition"

const transitionSchema = z.object({
  appointmentId: z.uuid(),
  to: z.enum(APPOINTMENT_STATUSES),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional(),
  expectedFrom: z.enum(APPOINTMENT_STATUSES).optional(),
})

/**
 * Status changes for every role. Authorization lives in transitionAppointment
 * (clinic scope + transition table), not in the UI that renders the buttons.
 */
export async function changeAppointmentStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const user = await requireUser()
  const parsed = transitionSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)

  const result = await transitionAppointment(user, parsed.data)
  if (!result.ok) return { ok: false, code: result.code, error: result.error }

  revalidatePath("/account", "layout")
  revalidatePath("/staff", "layout")
  return { ok: true, data: { status: result.status } }
}
