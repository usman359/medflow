import { TZDate } from "@date-fns/tz"

/**
 * Pure slot generation. No I/O, so it is unit-tested directly (DST, time off,
 * overlaps). Weekly rules are expressed in each clinic's local time; every
 * returned slot is an absolute instant.
 */

export type SlotRule = {
  clinicId: string
  timeZone: string
  /** 0 = Sunday … 6 = Saturday, in the clinic's timezone */
  weekday: number
  /** "HH:MM" or "HH:MM:SS", clinic-local */
  startTime: string
  endTime: string
  slotMinutes: number
  /** Inclusive "YYYY-MM-DD" bounds, clinic-local; null = open-ended */
  validFrom?: string | null
  validTo?: string | null
}

/** A period the doctor can't be booked: an appointment or time off. A null clinicId blocks every clinic. */
export type BusyPeriod = { startsAt: Date; endsAt: Date; clinicId?: string | null }

export type Slot = { clinicId: string; startsAt: Date; endsAt: Date }

export type GenerateSlotsInput = {
  rules: SlotRule[]
  busy: BusyPeriod[]
  from: Date
  to: Date
  /** Length of the appointment being booked. Slots start on the rule's grid. */
  durationMinutes: number
  now: Date
  /** Minimum notice before a bookable slot. */
  leadMinutes?: number
}

const MINUTE = 60_000

function parseTime(value: string): [number, number] {
  const [h, m] = value.split(":").map(Number)
  return [h, m]
}

function isoDate(d: TZDate) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function generateSlots({
  rules,
  busy,
  from,
  to,
  durationMinutes,
  now,
  leadMinutes = 60,
}: GenerateSlotsInput): Slot[] {
  const earliest = Math.max(from.getTime(), now.getTime() + leadMinutes * MINUTE)
  const latest = to.getTime()
  if (earliest >= latest || durationMinutes <= 0) return []

  const slots: Slot[] = []
  const seen = new Set<string>()

  for (const rule of rules) {
    const [startH, startM] = parseTime(rule.startTime)
    const [endH, endM] = parseTime(rule.endTime)
    const step = Math.max(5, rule.slotMinutes)
    const blocking = busy.filter((b) => !b.clinicId || b.clinicId === rule.clinicId)

    // Walk clinic-local calendar days that intersect [earliest, latest).
    const first = new TZDate(earliest, rule.timeZone)
    for (let offset = 0; ; offset++) {
      const day = new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + offset, rule.timeZone)
      if (day.getTime() >= latest) break
      if (day.getDay() !== rule.weekday) continue
      const date = isoDate(day)
      if (rule.validFrom && date < rule.validFrom) continue
      if (rule.validTo && date > rule.validTo) continue

      const y = day.getFullYear()
      const mo = day.getMonth()
      const d = day.getDate()
      const blockEnd = new TZDate(y, mo, d, endH, endM, rule.timeZone).getTime()
      // Step in local wall-clock minutes so a DST change never shifts the grid.
      for (let minutes = startH * 60 + startM; ; minutes += step) {
        const start = new TZDate(y, mo, d, Math.floor(minutes / 60), minutes % 60, rule.timeZone).getTime()
        const end = start + durationMinutes * MINUTE
        if (end > blockEnd) break
        if (start < earliest || end > latest) continue
        if (blocking.some((b) => start < b.endsAt.getTime() && b.startsAt.getTime() < end)) continue
        const key = `${rule.clinicId}|${start}`
        if (seen.has(key)) continue
        seen.add(key)
        slots.push({ clinicId: rule.clinicId, startsAt: new Date(start), endsAt: new Date(end) })
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/** True when `startsAt` is exactly one of the generated slots — used to re-validate a booking request. */
export function isGeneratedSlot(input: GenerateSlotsInput, clinicId: string, startsAt: Date): boolean {
  return generateSlots({
    ...input,
    from: new Date(Math.max(input.from.getTime(), startsAt.getTime())),
    to: new Date(Math.min(input.to.getTime(), startsAt.getTime() + (input.durationMinutes + 1) * MINUTE)),
  }).some((s) => s.clinicId === clinicId && s.startsAt.getTime() === startsAt.getTime())
}
