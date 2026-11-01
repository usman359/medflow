import { relations } from "drizzle-orm"
import { user } from "./auth"
import {
  clinics,
  doctorClinics,
  doctors,
  doctorServices,
  doctorSpecialties,
  services,
  specialties,
  staffClinics,
} from "./catalog"
import { appointments, availabilityExceptions, availabilityRules, patients, visitNotes } from "./scheduling"

export const userRelations = relations(user, ({ one, many }) => ({
  doctor: one(doctors, { fields: [user.id], references: [doctors.userId] }),
  patient: one(patients, { fields: [user.id], references: [patients.userId] }),
  staffClinics: many(staffClinics),
}))

export const clinicRelations = relations(clinics, ({ many }) => ({
  doctorClinics: many(doctorClinics),
  appointments: many(appointments),
}))

export const specialtyRelations = relations(specialties, ({ many }) => ({
  services: many(services),
  doctorSpecialties: many(doctorSpecialties),
}))

export const serviceRelations = relations(services, ({ one, many }) => ({
  specialty: one(specialties, { fields: [services.specialtyId], references: [specialties.id] }),
  doctorServices: many(doctorServices),
}))

export const doctorRelations = relations(doctors, ({ one, many }) => ({
  user: one(user, { fields: [doctors.userId], references: [user.id] }),
  doctorSpecialties: many(doctorSpecialties),
  doctorClinics: many(doctorClinics),
  doctorServices: many(doctorServices),
  availabilityRules: many(availabilityRules),
  appointments: many(appointments),
}))

export const doctorSpecialtyRelations = relations(doctorSpecialties, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorSpecialties.doctorId], references: [doctors.id] }),
  specialty: one(specialties, { fields: [doctorSpecialties.specialtyId], references: [specialties.id] }),
}))

export const doctorClinicRelations = relations(doctorClinics, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorClinics.doctorId], references: [doctors.id] }),
  clinic: one(clinics, { fields: [doctorClinics.clinicId], references: [clinics.id] }),
}))

export const doctorServiceRelations = relations(doctorServices, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorServices.doctorId], references: [doctors.id] }),
  service: one(services, { fields: [doctorServices.serviceId], references: [services.id] }),
}))

export const staffClinicRelations = relations(staffClinics, ({ one }) => ({
  user: one(user, { fields: [staffClinics.userId], references: [user.id] }),
  clinic: one(clinics, { fields: [staffClinics.clinicId], references: [clinics.id] }),
}))

export const availabilityRuleRelations = relations(availabilityRules, ({ one }) => ({
  doctor: one(doctors, { fields: [availabilityRules.doctorId], references: [doctors.id] }),
  clinic: one(clinics, { fields: [availabilityRules.clinicId], references: [clinics.id] }),
}))

export const availabilityExceptionRelations = relations(availabilityExceptions, ({ one }) => ({
  doctor: one(doctors, { fields: [availabilityExceptions.doctorId], references: [doctors.id] }),
  clinic: one(clinics, { fields: [availabilityExceptions.clinicId], references: [clinics.id] }),
}))

export const patientRelations = relations(patients, ({ one, many }) => ({
  user: one(user, { fields: [patients.userId], references: [user.id] }),
  appointments: many(appointments),
}))

export const appointmentRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  doctor: one(doctors, { fields: [appointments.doctorId], references: [doctors.id] }),
  clinic: one(clinics, { fields: [appointments.clinicId], references: [clinics.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  visitNote: one(visitNotes, { fields: [appointments.id], references: [visitNotes.appointmentId] }),
}))

export const visitNoteRelations = relations(visitNotes, ({ one }) => ({
  appointment: one(appointments, { fields: [visitNotes.appointmentId], references: [appointments.id] }),
  doctor: one(doctors, { fields: [visitNotes.doctorId], references: [doctors.id] }),
}))
