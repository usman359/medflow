/** Minimal RFC 5545 calendar file for a single event. */

function stamp(d: Date) {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** Lines longer than 75 octets must be folded with CRLF + space. */
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = " " + rest.slice(74)
  }
  out.push(rest)
  return out.join("\r\n")
}

export function buildIcs(event: {
  uid: string
  start: Date
  end: Date
  title: string
  description?: string
  location?: string
  now?: Date
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedFlow//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(event.now ?? new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null)
  return lines.map(fold).join("\r\n") + "\r\n"
}
