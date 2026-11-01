import { z } from "zod"
import { ROLES } from "@/lib/domain"
import { emailField } from "./auth"

const role = z.enum(ROLES)

export const updateAccessSchema = z.object({
  userId: z.string().min(1),
  role,
  /** Clinics for reception and managers. Ignored for other roles. */
  clinicIds: z.array(z.uuid()),
  /** The doctor profile this login belongs to (doctor role only). */
  doctorId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
})
export type UpdateAccessInput = z.input<typeof updateAccessSchema>
export type UpdateAccessOutput = z.output<typeof updateAccessSchema>

export const STAFF_PASSWORD_MIN = 10

const password = z.string().min(STAFF_PASSWORD_MIN, `Use at least ${STAFF_PASSWORD_MIN} characters`).max(128)

export const newStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's full name").max(100),
  email: emailField,
  password,
  role: role.exclude(["patient"]),
  clinicIds: z.array(z.uuid()),
  doctorId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
})
export type NewStaffInput = z.input<typeof newStaffSchema>
export type NewStaffOutput = z.output<typeof newStaffSchema>

export const resetPasswordSchema = z.object({ userId: z.string().min(1), password })
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
