import type { AppointmentStatus, Role } from "./domain"

/**
 * The appointment lifecycle as a pure transition table.
 * Server actions are the enforcement point; the UI uses the same table to
 * decide which buttons to show.
 *
 *   requested ─┬─▶ confirmed ─┬─▶ checked_in ─▶ completed
 *              │              ├─▶ no_show
 *              └─▶ cancelled ◀┘
 */

type Actor = Role | "patient_owner"

export const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, readonly Actor[]>>> = {
  requested: {
    confirmed: ["receptionist", "manager", "admin"],
    cancelled: ["receptionist", "manager", "admin", "patient_owner"],
  },
  confirmed: {
    checked_in: ["receptionist", "manager", "admin"],
    cancelled: ["receptionist", "manager", "admin", "patient_owner"],
    no_show: ["receptionist", "manager", "admin"],
  },
  checked_in: {
    completed: ["doctor", "receptionist", "manager", "admin"],
  },
  completed: {},
  cancelled: {},
  no_show: {},
}

export const FINAL_STATUSES: readonly AppointmentStatus[] = ["completed", "cancelled", "no_show"]

export type TransitionContext = {
  role: Role
  /** The acting user owns the appointment (patient). */
  isOwner?: boolean
  /** Appointment start, used for time-based rules. */
  startsAt?: Date
  now?: Date
}

export type TransitionCheck = { allowed: true } | { allowed: false; reason: string }

export function canTransition(from: AppointmentStatus, to: AppointmentStatus, ctx: TransitionContext): TransitionCheck {
  if (from === to) return { allowed: false, reason: "The appointment is already in that status." }
  const actors = TRANSITIONS[from]?.[to]
  if (!actors) {
    return { allowed: false, reason: `An appointment cannot move from ${from} to ${to}.` }
  }

  const now = ctx.now ?? new Date()

  if (ctx.role === "patient") {
    if (!ctx.isOwner || !actors.includes("patient_owner")) {
      return { allowed: false, reason: "You don't have permission to make this change." }
    }
    if (ctx.startsAt && ctx.startsAt <= now) {
      return {
        allowed: false,
        reason: "Appointments can't be cancelled online after they start. Please call the clinic.",
      }
    }
    return { allowed: true }
  }

  if (!actors.includes(ctx.role)) {
    return { allowed: false, reason: "Your role can't make this change." }
  }

  // Marking a no-show before the appointment has started makes no sense.
  if (to === "no_show" && ctx.startsAt && ctx.startsAt > now) {
    return { allowed: false, reason: "You can only mark a no-show after the appointment start time." }
  }

  return { allowed: true }
}

/** Next statuses an actor may move to (for rendering action buttons). */
export function availableTransitions(from: AppointmentStatus, ctx: TransitionContext): AppointmentStatus[] {
  return (Object.keys(TRANSITIONS[from] ?? {}) as AppointmentStatus[]).filter(
    (to) => canTransition(from, to, ctx).allowed
  )
}
