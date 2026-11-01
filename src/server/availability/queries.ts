import "server-only"
import { and, eq, gt, inArray, lt } from "drizzle-orm"
import { db, type DbOrTx } from "@/db"
import { appointments, availabilityExceptions, availabilityRules, clinics } from "@/db/schema"
import { ACTIVE_STATUSES } from "@/lib/domain"
import { generateSlots, type GenerateSlotsInput, type Slot } from "./slots"

export const MAX_BOOKING_WINDOW_DAYS = 60
const DAY = 86_400_000

/**
 * Loads everything slot generation needs for one doctor over [from, to).
 * Appointments at *every* clinic block the doctor, since they can't be in two
 * places at once; rules can be narrowed to one clinic.
 */
export async function loadAvailability(
  opts: { doctorId: string; clinicId?: string; from: Date; to: Date },
  conn: DbOrTx = db
) {
  const { doctorId, clinicId, from, to } = opts

  const [rules, booked, timeOff] = await Promise.all([
    conn
      .select({
        clinicId: availabilityRules.clinicId,
        timeZone: clinics.timezone,
        weekday: availabilityRules.weekday,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
        slotMinutes: availabilityRules.slotMinutes,
        validFrom: availabilityRules.validFrom,
        validTo: availabilityRules.validTo,
      })
      .from(availabilityRules)
      .innerJoin(clinics, eq(clinics.id, availabilityRules.clinicId))
      .where(
        and(
          eq(availabilityRules.doctorId, doctorId),
          eq(clinics.isActive, true),
          clinicId ? eq(availabilityRules.clinicId, clinicId) : undefined
        )
      ),
    conn
      .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          lt(appointments.startsAt, to),
          gt(appointments.endsAt, from)
        )
      ),
    conn
      .select({
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
        clinicId: availabilityExceptions.clinicId,
      })
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.doctorId, doctorId),
          lt(availabilityExceptions.startsAt, to),
          gt(availabilityExceptions.endsAt, from)
        )
      ),
  ])

  return { rules, booked, timeOff }
}

export async function loadSlotInput(
  opts: { doctorId: string; clinicId?: string; from: Date; to: Date; durationMinutes: number; now?: Date },
  conn: DbOrTx = db
): Promise<GenerateSlotsInput> {
  const { rules, booked, timeOff } = await loadAvailability(opts, conn)
  const { from, to, durationMinutes, now = new Date() } = opts
  return { rules, busy: [...booked, ...timeOff], from, to, durationMinutes, now }
}

export async function getAvailableSlots(opts: {
  doctorId: string
  clinicId?: string
  from: Date
  to: Date
  durationMinutes: number
}): Promise<Slot[]> {
  const to = new Date(Math.min(opts.to.getTime(), Date.now() + MAX_BOOKING_WINDOW_DAYS * DAY))
  if (to <= opts.from) return []
  return generateSlots(await loadSlotInput({ ...opts, to }))
}

/** The next few bookable slots for a doctor (profile pages, cards). */
export async function getNextAvailableSlots(doctorId: string, limit = 6, durationMinutes = 30): Promise<Slot[]> {
  const from = new Date()
  const slots = await getAvailableSlots({ doctorId, from, to: new Date(from.getTime() + 21 * DAY), durationMinutes })
  return slots.slice(0, limit)
}
