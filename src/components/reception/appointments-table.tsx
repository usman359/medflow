import { Phone, Video } from "lucide-react"
import { StatusActions } from "@/components/appointments/status-actions"
import { ScrollRegion } from "@/components/scroll-region"
import { StatusBadge } from "@/components/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { availableTransitions } from "@/lib/appointment-state"
import type { Role } from "@/lib/domain"
import { formatInZone, TIMEZONE_ABBR } from "@/lib/format"
import type { StaffAppointmentRow } from "@/server/appointments/staff-queries"

type Props = {
  rows: StaffAppointmentRow[]
  role: Role
  showClinic: boolean
  showZone: boolean
  now: Date
}

function whenLabel(row: StaffAppointmentRow, showZone: boolean) {
  const t = formatInZone(row.startsAt, row.clinicTimezone, "h:mm a")
  return showZone ? `${t} ${TIMEZONE_ABBR[row.clinicTimezone] ?? ""}`.trim() : t
}

function Actions({ row, role, now }: { row: StaffAppointmentRow; role: Role; now: Date }) {
  const transitions = availableTransitions(row.status, { role, startsAt: row.startsAt, now })
  if (transitions.length === 0) return <span className="text-sm text-muted-foreground">No actions</span>
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <StatusActions appointmentId={row.id} status={row.status} transitions={transitions} size="sm" />
    </div>
  )
}

function PatientCell({ row }: { row: StaffAppointmentRow }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-medium">{row.patientName}</span>
      <a
        href={`tel:${row.patientPhone.replace(/[^\d+]/g, "")}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <Phone className="size-3" aria-hidden="true" />
        {row.patientPhone}
      </a>
    </div>
  )
}

export function AppointmentsTable({ rows, role, showClinic, showZone, now }: Props) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <ScrollRegion label="Appointments" className="hidden rounded-2xl border bg-card md:block">
        <Table>
          <caption className="sr-only">Appointments</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="align-top font-semibold whitespace-nowrap text-teal-900">
                  {whenLabel(row, showZone)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60000)} min
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  <PatientCell row={row} />
                  <span className="mt-1 line-clamp-1 block max-w-xs text-sm text-muted-foreground" title={row.reason}>
                    {row.reason}
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  <span className="font-medium">{row.doctorName}</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {row.consultationType === "video" && <Video className="size-3.5" aria-label="Video visit" />}
                    {row.serviceName ?? "—"}
                  </span>
                  {showClinic && (
                    <span className="block text-sm text-muted-foreground">
                      {row.clinicName.replace(/^MedFlow\s+/, "")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={row.status} />
                  {row.source === "reception" && (
                    <span className="mt-1 block text-xs text-muted-foreground">Booked by staff</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Actions row={row} role={role} now={now} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollRegion>

      {/* Phones: stacked cards */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-3 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-teal-900">{whenLabel(row, showZone)}</p>
                <p className="text-sm text-muted-foreground">
                  {row.doctorName}
                  {showClinic ? ` · ${row.clinicName.replace(/^MedFlow\s+/, "")}` : ""}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <PatientCell row={row} />
            <p className="text-sm text-muted-foreground">{row.reason}</p>
            <Actions row={row} role={role} now={now} />
          </li>
        ))}
      </ul>
    </>
  )
}
