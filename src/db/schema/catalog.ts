import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const consultationTypeEnum = pgEnum("consultation_type", ["in_person", "video"])

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  addressLine: text("address_line").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  timezone: text("timezone").notNull().default("America/New_York"),
  photoUrl: text("photo_url"),
  openingHours: text("opening_hours"),
  autoConfirmOnline: boolean("auto_confirm_online").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const specialties = pgTable("specialties", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  /** lucide icon name rendered by the UI */
  icon: text("icon").notNull().default("stethoscope"),
})

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => specialties.id, { onDelete: "restrict" }),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    priceCents: integer("price_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("services_specialty_idx").on(t.specialtyId)]
)

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  bio: text("bio").notNull(),
  photoUrl: text("photo_url"),
  yearsExperience: integer("years_experience").notNull().default(0),
  languages: text("languages").array().notNull().default(["English"]),
  consultationTypes: consultationTypeEnum("consultation_types").array().notNull().default(["in_person"]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const doctorSpecialties = pgTable(
  "doctor_specialties",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => specialties.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.doctorId, t.specialtyId] })]
)

export const doctorClinics = pgTable(
  "doctor_clinics",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.doctorId, t.clinicId] }), index("doctor_clinics_clinic_idx").on(t.clinicId)]
)

export const doctorServices = pgTable(
  "doctor_services",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.doctorId, t.serviceId] }), index("doctor_services_service_idx").on(t.serviceId)]
)

/** Receptionists and managers are scoped to the clinics listed here. */
export const staffClinics = pgTable(
  "staff_clinics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clinicId] })]
)
