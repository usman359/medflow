import type { Metadata } from "next"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { BookingsChart } from "@/components/reports/bookings-chart"
import { ScrollRegion } from "@/components/scroll-region"
import { ReportToolbar } from "@/components/reports/report-toolbar"
import { currentTime, formatInZone } from "@/lib/format"
import { loadReportParams } from "@/lib/search-params/reports"
import { requireRole } from "@/server/auth"
import { getReport } from "@/server/reports/queries"
import { loadManagedClinics } from "@/server/settings/queries"
import type { StatusBreakdown } from "@/server/reports/queries"

export const metadata: Metadata = { title: "Reports" }

const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`)

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold text-teal-900 tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
    </div>
  )
}

function BreakdownTable({
  title,
  nameLabel,
  rows,
}: {
  title: string
  nameLabel: string
  rows: ({ name: string; noShowRate?: number | null } & StatusBreakdown)[]
}) {
  const showRate = rows.some((r) => "noShowRate" in r)
  return (
    <section aria-labelledby={`${title}-title`} className="grid min-w-0 content-start gap-3">
      <h2 id={`${title}-title`} className="text-xl font-semibold">
        {title}
      </h2>
      <ScrollRegion label={`${title} table`} className="rounded-2xl border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-2.5 font-medium">
                {nameLabel}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Total
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Completed
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Cancelled
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                No-show
              </th>
              {showRate && (
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  No-show rate
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0">
                <th scope="row" className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {r.name}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.completed}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.cancelled}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.noShow}</td>
                {showRate && <td className="px-4 py-2.5 text-right tabular-nums">{pct(r.noShowRate ?? null)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </section>
  )
}

export default async function ReportsPage({ searchParams }: PageProps<"/staff/manager/reports">) {
  const user = await requireRole("manager", "admin")
  const params = await loadReportParams(searchParams)
  const managed = await loadManagedClinics(user)
  const now = currentTime()
  const today = formatInZone(now, managed[0]?.timezone ?? "America/New_York", "yyyy-MM-dd")
  const report = await getReport(user, { from: params.from ?? "", to: params.to ?? "", clinic: params.clinic }, today)
  const { totals } = report

  return (
    <>
      <PageHeader
        title="Reports"
        description="How appointments are booked, attended and cancelled. Counted by the day they take place."
      />
      <ReportToolbar
        today={today}
        from={report.range.from}
        to={report.range.to}
        clinic={params.clinic && report.clinics.some((c) => c.slug === params.clinic) ? params.clinic : null}
        clinics={report.clinics}
      />

      {report.clinics.length === 0 ? (
        <EmptyState
          title="No clinic assigned to your account"
          description="Ask a system administrator to assign you to a clinic."
        />
      ) : totals.total === 0 ? (
        <EmptyState
          title="No appointments in this period"
          description="Try a longer date range or a different clinic."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label="Appointments"
              value={totals.total}
              note={`${totals.online} online · ${totals.reception} by staff`}
            />
            <Kpi label="Completed" value={totals.completed} note={`${totals.open} still to come`} />
            <Kpi label="Cancelled" value={totals.cancelled} note={`${pct(totals.cancellationRate)} of bookings`} />
            <Kpi label="No-shows" value={totals.noShow} />
            <Kpi label="No-show rate" value={pct(totals.noShowRate)} note="Of visits that were due" />
          </dl>

          <section aria-labelledby="chart-title" className="grid min-w-0 gap-3 rounded-3xl border bg-card p-5">
            <h2 id="chart-title" className="text-xl font-semibold">
              Appointments over time
            </h2>
            <BookingsChart data={report.daily} />
          </section>

          <div className="grid gap-8 xl:grid-cols-2">
            <BreakdownTable title="By doctor" nameLabel="Doctor" rows={report.byDoctor} />
            <BreakdownTable title="By specialty" nameLabel="Specialty" rows={report.bySpecialty} />
          </div>
        </>
      )}
    </>
  )
}
