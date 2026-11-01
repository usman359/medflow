import { z } from "zod"
import { CONSULTATION_TYPES } from "@/lib/domain"

const phone = z
  .string()
  .trim()
  .min(7, "Enter a phone number we can reach you on")
  .max(25)
  .regex(/^[+()\d\s.-]+$/, "Use digits, spaces and + ( ) - only")

export const patientDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(60),
  lastName: z.string().trim().min(1, "Enter your last name").max(60),
  dateOfBirth: z.iso
    .date("Enter your date of birth")
    .refine((v) => v <= new Date().toISOString().slice(0, 10), "Date of birth can't be in the future")
    .refine((v) => v >= "1900-01-01", "Enter a valid date of birth"),
  phone,
})
export type PatientDetailsInput = z.infer<typeof patientDetailsSchema>

export const createBookingSchema = z.object({
  doctorId: z.uuid(),
  clinicId: z.uuid(),
  serviceId: z.uuid(),
  consultationType: z.enum(CONSULTATION_TYPES),
  startsAt: z.iso.datetime({ offset: true }),
  reason: z
    .string()
    .trim()
    .min(3, "Tell the doctor briefly why you're coming in")
    .max(500, "Keep it under 500 characters"),
  idempotencyKey: z.uuid(),
})
export type CreateBookingInput = z.infer<typeof createBookingSchema>

/** Reception / phone bookings: same booking fields plus who the patient is. */
export const receptionBookingSchema = createBookingSchema.extend({
  patientId: z.uuid().optional(),
  newPatient: patientDetailsSchema
    .extend({
      dateOfBirth: z.iso.date().optional().or(z.literal("")),
      email: z.email().optional().or(z.literal("")),
    })
    .optional(),
})
export type ReceptionBookingInput = z.infer<typeof receptionBookingSchema>
