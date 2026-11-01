import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { appointments } from "@/db/schema"
import { canTransition } from "@/lib/appointment-state"
import type { AppointmentStatus } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import { recordAudit } from "@/server/audit"
import type { CurrentUser } from "@/server/auth"
import { createNotification, type NotificationInput } from "@/server/notifications"
import { canViewAppointment } from "./access"
import { loadAppointmentDetail } from "./queries"

export type TransitionResult =
  { ok: true; status: AppointmentStatus } | { ok: false; code: "NOT_FOUND" | "NOT_ALLOWED" | "CONFLICT"; error: string }

const NOTIFY: Partial<Record<AppointmentStatus, { type: NotificationInput["type"]; title: string; email: boolean }>> = {
  confirmed: { type: "appointment_confirmed", title: "Your appointment is confirmed", email: true },
  checked_in: { type: "appointment_checked_in", title: "You're checked in", email: false },
  completed: { type: "appointment_completed", title: "Your visit is complete", email: false },
  cancelled: { type: "appointment_cancelled", title: "Your appointment was cancelled", email: true },
  no_show: { type: "appointment_no_show", title: "Appointment marked as missed", email: false },
}

const TIMESTAMP_FIELD: Partial<
  Record<AppointmentStatus, "confirmedAt" | "checkedInAt" | "completedAt" | "cancelledAt">
> = {
  confirmed: "confirmedAt",
  checked_in: "checkedInAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
}

/**
 * The only way an appointment changes status. Enforces, in order:
 *  1. the actor can see the appointment (clinic / ownership scope),
 *  2. the transition table allows this actor to make this move,
 *  3. the row is still in the status the actor was looking at (optimistic
 *     concurrency), so two people can't apply conflicting changes.
 * The audit event and patient notification are written in the same transaction.
 */
export async function transitionAppointment(
  actor: CurrentUser,
  input: { appointmentId: string; to: AppointmentStatus; reason?: string | null; expectedFrom?: AppointmentStatus }
): Promise<TransitionResult> {
  const appt = await loadAppointmentDetail(input.appointmentId)
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!appt || !(await canViewAppointment(actor, appt))) {
    return { ok: false, code: "NOT_FOUND", error: "We couldn't find that appointment." }
  }

  const from = appt.status
  if (input.expectedFrom && input.expectedFrom !== from) {
    return {
      ok: false,
      code: "CONFLICT",
      error: `This appointment was just changed to "${from.replace("_", " ")}". Refresh to see the latest.`,
    }
  }

  const check = canTransition(from, input.to, {
    role: actor.role,
    isOwner: actor.role === "patient" && appt.patientUserId === actor.id,
    startsAt: appt.startsAt,
  })
  if (!check.allowed) return { ok: false, code: "NOT_ALLOWED", error: check.reason }

  const now = new Date()
  const reason = input.reason?.trim() || null
  const timestamp = TIMESTAMP_FIELD[input.to]
  const when =
    `${formatInZone(appt.startsAt, appt.clinicTimezone, "EEEE, MMMM d 'at' h:mm a")} ${TIMEZONE_ABBR[appt.clinicTimezone] ?? ""}`.trim()
  const notify = NOTIFY[input.to]

  const outcome = await db.transaction(async (tx) => {
    const updated = await tx
      .update(appointments)
      .set({
        status: input.to,
        updatedAt: now,
        ...(timestamp ? { [timestamp]: now } : {}),
        ...(input.to === "cancelled" ? { cancelledReason: reason } : {}),
      })
      // The status guard is what makes concurrent changes safe.
      .where(and(eq(appointments.id, appt.id), eq(appointments.status, from)))
      .returning({ id: appointments.id })
    if (updated.length === 0) return null

    await recordAudit(tx, {
      actor: { id: actor.id, role: actor.role },
      entityType: "appointment",
      entityId: appt.id,
      action: "status_changed",
      fromStatus: from,
      toStatus: input.to,
      metadata: { reference: appt.reference, ...(reason ? { reason } : {}) },
    })

    const deliver =
      notify && appt.patientUserId && appt.patientUserId !== actor.id
        ? await createNotification(
            tx,
            {
              userId: appt.patientUserId,
              type: notify.type,
              title: notify.title,
              body: `${appt.serviceName ?? "Appointment"} with ${appt.doctorName} at ${appt.clinicName}, ${when}. Reference ${appt.reference}.${reason && input.to === "cancelled" ? ` Reason: ${reason}.` : ""}`,
              link: `/account/appointments/${appt.id}`,
            },
            notify.email ? appt.patientEmail : null
          )
        : null
    return { deliver }
  })

  if (!outcome) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "This appointment was just changed by someone else. Refresh to see the latest.",
    }
  }
  await outcome.deliver?.()
  return { ok: true, status: input.to }
}
