import { z } from "zod"
import { CONSULTATION_TYPES } from "@/lib/domain"

export const CLINIC_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()

const optionalUrl = z
  .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Enter a full web address starting with https://" })])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()

export const clinicSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter the clinic name").max(80),
  addressLine: z.string().trim().min(3, "Enter the street address").max(120),
  city: z.string().trim().min(2, "Enter the city").max(80),
  phone: z.string().trim().min(7, "Enter a phone number").max(25),
  email: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.email("Enter a valid email address")]))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  timezone: z.enum(CLINIC_TIMEZONES),
  openingHours: optionalText(120),
  photoUrl: optionalUrl,
  autoConfirmOnline: z.boolean(),
  isActive: z.boolean(),
})
export type ClinicInput = z.input<typeof clinicSchema>
export type ClinicOutput = z.output<typeof clinicSchema>

export const doctorSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter the doctor's name").max(80),
  title: z.string().trim().min(2, "Enter a title, e.g. Cardiologist").max(80),
  bio: z.string().trim().min(20, "Write at least a couple of sentences").max(1200),
  photoUrl: optionalUrl,
  yearsExperience: z.coerce.number().int("Whole years only").min(0).max(70),
  /** Comma-separated in the form, stored as an array. */
  languages: z
    .string()
    .trim()
    .min(2, "Enter at least one language")
    .transform((v) =>
      v
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().max(40)).min(1).max(10)),
  consultationTypes: z.array(z.enum(CONSULTATION_TYPES)).min(1, "Choose at least one visit type"),
  isActive: z.boolean(),
  clinicIds: z.array(z.uuid()).min(1, "Assign at least one clinic"),
  specialtyIds: z.array(z.uuid()).min(1, "Choose at least one specialty"),
  serviceIds: z.array(z.uuid()),
})
export type DoctorInput = z.input<typeof doctorSchema>
export type DoctorOutput = z.output<typeof doctorSchema>

export const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter the service name").max(80),
  description: z.string().trim().min(5, "Add a short description").max(300),
  specialtyId: z.uuid("Choose a specialty"),
  durationMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(240, "At most 4 hours"),
  /** Dollars in the form; stored as cents. */
  price: z.coerce.number().min(0, "Price can't be negative").max(100000),
  isActive: z.boolean(),
})
export type ServiceInput = z.input<typeof serviceSchema>
export type ServiceOutput = z.output<typeof serviceSchema>

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, for example 09:00")
const date = z.iso.date("Choose a date")

export const ruleSchema = z
  .object({
    doctorId: z.uuid(),
    clinicId: z.uuid("Choose a clinic"),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    slotMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(240),
    validFrom: z.union([z.literal(""), date]).transform((v) => (v === "" ? null : v)),
    validTo: z.union([z.literal(""), date]).transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End time must be after the start time" })
  .refine((v) => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, {
    path: ["validTo"],
    message: "Must be on or after the start date",
  })
export type RuleInput = z.input<typeof ruleSchema>
export type RuleOutput = z.output<typeof ruleSchema>

export const exceptionSchema = z
  .object({
    doctorId: z.uuid(),
    /** Empty string = every clinic the doctor works at. */
    clinicId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
    startDate: date,
    endDate: date,
    reason: z
      .string()
      .trim()
      .max(120)
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Must be on or after the first day" })
export type ExceptionInput = z.input<typeof exceptionSchema>
export type ExceptionOutput = z.output<typeof exceptionSchema>
