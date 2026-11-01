import { buildIcs } from "@/lib/ics"
import { getAppointmentForUser } from "@/server/appointments/queries"
import { getCurrentUser } from "@/server/auth"

export async function GET(_request: Request, ctx: RouteContext<"/api/appointments/[id]/ics">) {
  const user = await getCurrentUser()
  if (!user) return new Response("Sign in to download this appointment.", { status: 401 })

  const { id } = await ctx.params
  const appt = await getAppointmentForUser(id, user)
  // 404 rather than 403 so the response doesn't confirm the appointment exists.
  if (!appt) return new Response("Not found", { status: 404 })

  const ics = buildIcs({
    uid: `${appt.id}@medflow`,
    start: appt.startsAt,
    end: appt.endsAt,
    title: `${appt.serviceName ?? "Appointment"} with ${appt.doctorName}`,
    description: `MedFlow reference ${appt.reference}. Questions? Call ${appt.clinicName} on ${appt.clinicPhone}.`,
    location:
      appt.consultationType === "video"
        ? "Video call (link sent by email)"
        : `${appt.clinicName}, ${appt.clinicAddress}, ${appt.clinicCity}`,
  })

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="medflow-${appt.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  })
}
