/** Shared, client-safe domain constants. */

export const ROLES = ["patient", "receptionist", "doctor", "manager", "admin"] as const
export type Role = (typeof ROLES)[number]

export const STAFF_ROLES = ["receptionist", "doctor", "manager", "admin"] as const satisfies readonly Role[]

export const ROLE_LABELS: Record<Role, string> = {
  patient: "Patient",
  receptionist: "Reception",
  doctor: "Doctor",
  manager: "Clinic manager",
  admin: "System administrator",
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  patient: "/account",
  receptionist: "/staff/reception",
  doctor: "/staff/doctor",
  manager: "/staff/reception",
  admin: "/admin",
}

export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
}

/** Statuses that occupy a slot (mirrors the DB exclusion constraint predicate). */
export const ACTIVE_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
] as const satisfies readonly AppointmentStatus[]

export const CONSULTATION_TYPES = ["in_person", "video"] as const
export type ConsultationType = (typeof CONSULTATION_TYPES)[number]

export const CONSULTATION_LABELS: Record<ConsultationType, string> = {
  in_person: "In person",
  video: "Video call",
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
