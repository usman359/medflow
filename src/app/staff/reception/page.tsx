import { format } from "date-fns"
import type { Metadata } from "next"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { AppointmentsTable } from "@/components/reception/appointments-table"
import { NewBookingDialog } from "@/components/reception/new-booking-dialog"
import { ReceptionToolbar } from "@/components/reception/reception-toolbar"
import { currentTime, formatInZone } from "@/lib/format"
import { loadReceptionSearchParams } from "@/lib/search-params/reception"
import {
  getScopedClinics,
  listScopedDoctors,
  listStaffAppointments,
  loadStaffBookingOptions,
} from "@/server/appointments/staff-queries"
import { requireRole } from "@/server/auth"

export const metadata: Metadata = { title: "Appointments" }

export default async function ReceptionPage({ searchParams }: PageProps<"/staff/reception">) {
  const user = await requireRole("receptionist", "manager", "admin")
  const filters = await loadReceptionSearchParams(searchParams)

  const [{ rows, counts }, clinics, doctors, options] = await Promise.all([
    listStaffAppointments(user, filters),
    getScopedClinics(user),
    listScopedDoctors(user),
    loadStaffBookingOptions(user),
  ])

  const now = currentTime()
  const zone = clinics[0]?.timezone ?? "America/New_York"
  const today = formatInZone(now, zone, "yyyy-MM-dd")
  const dateParam = filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) ? filters.date : null
  const date = dateParam ?? today
  const [y, m, d] = date.split("-").map(Number)
  const heading = date === today ? "Today" : format(new Date(y, m - 1, d), "EEEE")
  const subtitle = format(new Date(y, m - 1, d), "MMMM d, yyyy")
  const zones = new Set(clinics.map((c) => c.timezone))
  const filtered = Boolean(filters.q || filters.status || filters.doctor || filters.clinic)

  return (
    <>
      <PageHeader
        title={`${heading} · Appointments`}
        description={`${subtitle} · ${clinics.map((c) => c.name.replace(/^MedFlow\s+/, "")).join(", ") || "No clinic assigned"}`}
        actions={clinics.length > 0 ? <NewBookingDialog options={options} today={today} /> : null}
      />

      {clinics.length === 0 ? (
        <EmptyState
          title="No clinic assigned to your account"
          description="Ask a system administrator to assign you to a clinic so you can see its appointments."
        />
      ) : (
        <>
          <ReceptionToolbar
            today={today}
            date={date}
            clinics={clinics.map(({ slug, name }) => ({ slug, name }))}
            doctors={doctors.map(({ slug, name }) => ({ slug, name }))}
            counts={counts}
          />
          {rows.length ? (
            <AppointmentsTable
              rows={rows}
              role={user.role}
              showClinic={clinics.length > 1}
              showZone={zones.size > 1}
              now={now}
            />
          ) : (
            <EmptyState
              title={filtered ? "No appointments match these filters" : "No appointments on this day"}
              description={
                filtered
                  ? "Try clearing a filter or choosing a different date."
                  : "Use “New booking” to add a phone or walk-in appointment."
              }
            />
          )}
        </>
      )}
    </>
  )
}
