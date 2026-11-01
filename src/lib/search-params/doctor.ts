import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server"

export const DOCTOR_VIEWS = ["day", "week"] as const

/** Doctor schedule state: which view, which day, and which appointment drawer is open. All in the URL. */
export const doctorScheduleParams = {
  view: parseAsStringLiteral(DOCTOR_VIEWS).withDefault("day"),
  /** Clinic-local YYYY-MM-DD; null means today. */
  date: parseAsString,
  appt: parseAsString,
}

export const loadDoctorScheduleParams = createLoader(doctorScheduleParams)
export const serializeDoctorSchedule = createSerializer(doctorScheduleParams)
