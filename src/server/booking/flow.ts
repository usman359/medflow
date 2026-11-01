import "server-only"
import type { ConsultationType } from "@/lib/domain"
import { formatInZone } from "@/lib/format"
import { BOOKING_STEPS, type BookingParams, type BookingStep } from "@/lib/search-params/booking"
import type { CurrentUser } from "@/server/auth"
import { getAvailableSlots, getNextAvailableSlots, MAX_BOOKING_WINDOW_DAYS } from "@/server/availability/queries"
import type { Slot } from "@/server/availability/slots"
import {
  getDoctorBySlug,
  getDoctorsForService,
  getServiceBySlug,
  getServicesBySpecialty,
} from "@/server/catalog/queries"
import { getPatientForUser, isPatientProfileComplete } from "@/server/patients/queries"

const DAY = 86_400_000

/**
 * Turns the URL params into a validated booking state: resolves slugs,
 * drops choices that no longer fit together, and works out which step to
 * show (the first incomplete one, unless the visitor went back to an earlier
 * step on purpose).
 */
export async function resolveBooking(params: BookingParams, user: CurrentUser | null) {
  const [catalog, service, doctorBySlug] = await Promise.all([
    getServicesBySpecialty(),
    params.service ? getServiceBySlug(params.service) : null,
    params.doctor ? getDoctorBySlug(params.doctor) : null,
  ])

  // A doctor chosen first (e.g. from their profile) narrows the services offered.
  const doctor =
    doctorBySlug && (!service || doctorBySlug.services.some((s) => s.id === service.id)) ? doctorBySlug : null
  const presetDoctor = doctorBySlug

  const clinic = doctor
    ? (doctor.clinics.find((c) => c.slug === params.clinic) ?? (doctor.clinics.length === 1 ? doctor.clinics[0] : null))
    : null
  const type: ConsultationType | null = doctor
    ? params.type && doctor.consultationTypes.includes(params.type)
      ? params.type
      : doctor.consultationTypes.length === 1
        ? doctor.consultationTypes[0]
        : null
    : null

  // Availability for the chosen doctor, clinic and service length.
  let slots: Slot[] = []
  let slot: Slot | null = null
  let slotGone = false
  let availableDates: string[] = []
  let date: string | null = null
  if (service && doctor && clinic) {
    const now = new Date()
    slots = await getAvailableSlots({
      doctorId: doctor.id,
      clinicId: clinic.id,
      from: now,
      to: new Date(now.getTime() + MAX_BOOKING_WINDOW_DAYS * DAY),
      durationMinutes: service.durationMinutes,
    })
    const localDate = (s: Slot) => formatInZone(s.startsAt, clinic.timezone, "yyyy-MM-dd")
    availableDates = [...new Set(slots.map(localDate))]
    if (params.slot) {
      const wanted = Date.parse(params.slot)
      slot = slots.find((s) => s.startsAt.getTime() === wanted) ?? null
      slotGone = !slot
    }
    date =
      (slot ? localDate(slot) : null) ??
      (params.date && availableDates.includes(params.date) ? params.date : null) ??
      (params.slot && !Number.isNaN(Date.parse(params.slot))
        ? availableDates.find((d) => d >= formatInZone(new Date(params.slot!), clinic.timezone, "yyyy-MM-dd"))
        : null) ??
      availableDates[0] ??
      null
  }
  const slotsForDate =
    clinic && date ? slots.filter((s) => formatInZone(s.startsAt, clinic.timezone, "yyyy-MM-dd") === date) : []

  const patient = user?.role === "patient" ? await getPatientForUser(user.id) : null
  const detailsDone = user?.role === "patient" && isPatientProfileComplete(patient)

  const firstIncomplete: BookingStep = !service
    ? "service"
    : !doctor
      ? "doctor"
      : !clinic || !type
        ? "clinic"
        : !slot
          ? "time"
          : !detailsDone
            ? "details"
            : "review"
  const step =
    params.step && BOOKING_STEPS.indexOf(params.step) <= BOOKING_STEPS.indexOf(firstIncomplete)
      ? params.step
      : firstIncomplete

  // Options for the doctor step, each with their next opening.
  const doctorOptions =
    step === "doctor" && service
      ? await Promise.all(
          (await getDoctorsForService(service.id)).map(async (d) => ({
            doctor: d,
            next: (await getNextAvailableSlots(d.id, 1, service.durationMinutes))[0] ?? null,
          }))
        )
      : []

  return {
    step,
    firstIncomplete,
    catalog,
    service,
    presetDoctor,
    doctor,
    clinic,
    type,
    date,
    availableDates,
    slotsForDate,
    slot,
    slotGone,
    patient,
    doctorOptions,
  }
}

export type BookingState = Awaited<ReturnType<typeof resolveBooking>>
