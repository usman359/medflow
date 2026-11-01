import type { Metadata } from "next"
import Link from "next/link"
import { AppointmentRow } from "@/components/appointments/appointment-row"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listPatientAppointments } from "@/server/appointments/queries"
import { requireRole } from "@/server/auth"

export const metadata: Metadata = { title: "My appointments" }

export default async function AppointmentsPage({ searchParams }: PageProps<"/account/appointments">) {
  const user = await requireRole("patient")
  const { tab } = await searchParams
  const showPast = tab === "past"
  const { upcoming, past } = await listPatientAppointments(user.id)
  const rows = showPast ? past : upcoming

  const tabs = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length, href: "/account/appointments" },
    { key: "past", label: "Past", count: past.length, href: "/account/appointments?tab=past" },
  ]

  return (
    <>
      <PageHeader title="My appointments" description="Cancel, review details or add a visit to your calendar." />

      <nav aria-label="Appointment filter" className="flex gap-2">
        {tabs.map((t) => {
          const active = (t.key === "past") === showPast
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-accent",
                active && "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {t.label} <span className={cn("ml-1", active ? "opacity-80" : "text-muted-foreground")}>{t.count}</span>
            </Link>
          )
        })}
      </nav>

      {rows.length ? (
        <ul className="grid gap-3">
          {rows.map((a) => (
            <li key={a.id}>
              <AppointmentRow appointment={a} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={showPast ? "No past appointments yet" : "No upcoming appointments"}
          description={
            showPast ? "Completed and cancelled visits will appear here." : "Book a visit and it will appear here."
          }
          action={
            !showPast && (
              <Button asChild>
                <Link href="/book">Book an appointment</Link>
              </Button>
            )
          }
        />
      )}
    </>
  )
}
