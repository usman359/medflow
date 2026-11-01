import { sql } from "drizzle-orm"
import { check, date, index, integer, jsonb, pgEnum, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { clinics, consultationTypeEnum, doctors, services } from "./catalog"

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
])

export const bookingSourceEnum = pgEnum("booking_source", ["online", "reception"])

/** Recurring weekly working hours for a doctor at a clinic (times are clinic-local). */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday */
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
  },
  (t) => [
    index("availability_rules_doctor_idx").on(t.doctorId, t.clinicId),
    check("availability_rules_weekday_chk", sql`${t.weekday} between 0 and 6`),
    check("availability_rules_time_chk", sql`${t.endTime} > ${t.startTime}`),
    check("availability_rules_slot_chk", sql`${t.slotMinutes} between 5 and 240`),
  ]
)

/** Time off / blocked periods. A null clinic blocks the doctor at every clinic. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
  },
  (t) => [
    index("availability_exceptions_doctor_idx").on(t.doctorId, t.startsAt),
    check("availability_exceptions_range_chk", sql`${t.endsAt} > ${t.startsAt}`),
  ]
)

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for walk-in / phone patients created by reception. */
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    phone: text("phone").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patients_phone_idx").on(t.phone), index("patients_last_name_idx").on(t.lastName)]
)

/**
 * Overlap protection lives in a hand-written migration: GiST exclusion
 * constraints on (doctor_id, tstzrange) and (patient_id, tstzrange) for active
 * statuses. See src/db/migrations/*_booking_constraints.sql.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "restrict" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    consultationType: consultationTypeEnum("consultation_type").notNull().default("in_person"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("requested"),
    source: bookingSourceEnum("source").notNull().default("online"),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    cancelledReason: text("cancelled_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_clinic_starts_idx").on(t.clinicId, t.startsAt),
    index("appointments_doctor_starts_idx").on(t.doctorId, t.startsAt),
    index("appointments_patient_starts_idx").on(t.patientId, t.startsAt),
    index("appointments_status_idx").on(t.status),
    check("appointments_range_chk", sql`${t.endsAt} > ${t.startsAt}`),
  ]
)

export const visitNotes = pgTable("visit_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]
)

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_entity_idx").on(t.entityType, t.entityId, t.createdAt)]
)
