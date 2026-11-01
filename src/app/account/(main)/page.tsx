import { CalendarPlus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { AppointmentRow } from "@/components/appointments/appointment-row"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { Button } from "@/components/ui/button"
import { listPatientAppointments } from "@/server/appointments/queries"
import { requireRole } from "@/server/auth"
import { getPatientForUser, isPatientProfileComplete } from "@/server/patients/queries"

export const metadata: Metadata = { title: "My account" }

export default async function AccountPage() {
  const user = await requireRole("patient")
  const [{ upcoming }, patient] = await Promise.all([listPatientAppointments(user.id), getPatientForUser(user.id)])
  const next = upcoming.slice(0, 3)

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Your upcoming visits and appointment history."
        actions={
          <Button asChild>
            <Link href="/book">
              <CalendarPlus aria-hidden="true" /> Book appointment
            </Link>
          </Button>
        }
      />

      {!isPatientProfileComplete(patient) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-coral-soft p-4">
          <p className="text-sm text-coral-ink">
            <span className="font-semibold">Finish your profile</span> so booking takes one click next time.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/account/profile">Add details</Link>
          </Button>
        </div>
      )}

      <section aria-labelledby="next-title" className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 id="next-title" className="text-xl font-semibold">
            Coming up
          </h2>
          {upcoming.length > next.length && (
            <Link
              href="/account/appointments"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See all {upcoming.length}
            </Link>
          )}
        </div>
        {next.length ? (
          <ul className="grid gap-3">
            {next.map((a) => (
              <li key={a.id}>
                <AppointmentRow appointment={a} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No upcoming appointments"
            description="When you book a visit it will show up here, with a reminder before you go."
            action={
              <Button asChild>
                <Link href="/book">Book your first visit</Link>
              </Button>
            }
          />
        )}
      </section>
    </>
  )
}
