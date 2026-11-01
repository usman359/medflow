import { currentTime, formatInZone } from "@/lib/format"
import { loadReportParams } from "@/lib/search-params/reports"
import { getCurrentUser } from "@/server/auth"
import { getReportCsv } from "@/server/reports/queries"
import { loadManagedClinics } from "@/server/settings/queries"

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response("Sign in to export reports.", { status: 401 })
  // Only managers and admins; everyone else gets the same answer as a missing page.
  if (user.role !== "manager" && user.role !== "admin") return new Response("Not found", { status: 404 })

  const params = loadReportParams(new URL(request.url).searchParams)
  const managed = await loadManagedClinics(user)
  const today = formatInZone(currentTime(), managed[0]?.timezone ?? "America/New_York", "yyyy-MM-dd")
  const csv = await getReportCsv(user, { from: params.from ?? "", to: params.to ?? "", clinic: params.clinic }, today)

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="medflow-appointments-${params.from ?? "start"}-to-${params.to ?? today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  })
}
