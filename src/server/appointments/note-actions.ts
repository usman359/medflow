"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { visitNotes } from "@/db/schema"
import { fromZodError, type ActionResult } from "@/lib/action-result"
import { visitNoteSchema } from "@/lib/validation/visit-note"
import { recordAudit } from "@/server/audit"
import { requireRole } from "@/server/auth"
import { getDoctorAppointmentDetail } from "./doctor-queries"

/**
 * Only the treating doctor can write a note, and only once the patient has
 * arrived (checked in) or the visit is complete. Doctor-ness and ownership are
 * checked here, not by whichever screen rendered the editor.
 */
export async function saveVisitNoteAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const user = await requireRole("doctor")
  const parsed = visitNoteSchema.safeParse(input)
  if (!parsed.success) return fromZodError(parsed.error)

  const appt = await getDoctorAppointmentDetail(user, parsed.data.appointmentId)
  if (!appt) return { ok: false, code: "NOT_FOUND", error: "We couldn't find that appointment." }
  if (appt.status !== "checked_in" && appt.status !== "completed") {
    return { ok: false, code: "NOT_ALLOWED", error: "Notes can be added once the patient has checked in." }
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .insert(visitNotes)
      .values({ appointmentId: appt.id, doctorId: appt.doctorId, body: parsed.data.body, updatedAt: now })
      .onConflictDoUpdate({ target: visitNotes.appointmentId, set: { body: parsed.data.body, updatedAt: now } })
    await recordAudit(tx, {
      actor: { id: user.id, role: user.role },
      entityType: "appointment",
      entityId: appt.id,
      action: appt.note ? "visit_note_updated" : "visit_note_created",
      // Never copy clinical text into the audit log.
      metadata: { reference: appt.reference },
    })
  })

  revalidatePath("/staff/doctor")
  return { ok: true, data: { savedAt: now.toISOString() } }
}

/** Remove a note (e.g. written on the wrong visit). */
export async function deleteVisitNoteAction(appointmentId: unknown): Promise<ActionResult> {
  const user = await requireRole("doctor")
  const parsed = visitNoteSchema.shape.appointmentId.safeParse(appointmentId)
  if (!parsed.success) return { ok: false, error: "Invalid appointment." }
  const appt = await getDoctorAppointmentDetail(user, parsed.data)
  if (!appt?.note) return { ok: false, code: "NOT_FOUND", error: "There's no note to delete." }

  await db.transaction(async (tx) => {
    await tx.delete(visitNotes).where(eq(visitNotes.appointmentId, appt.id))
    await recordAudit(tx, {
      actor: { id: user.id, role: user.role },
      entityType: "appointment",
      entityId: appt.id,
      action: "visit_note_deleted",
      metadata: { reference: appt.reference },
    })
  })
  revalidatePath("/staff/doctor")
  return { ok: true, data: undefined }
}
