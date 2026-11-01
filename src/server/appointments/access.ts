import "server-only"
import { getClinicScope, getDoctorIdForUser, scopeIncludes, type CurrentUser } from "@/server/auth"

/** The fields access decisions depend on. */
export type AppointmentAccessFacts = {
  clinicId: string
  doctorId: string
  patientUserId: string | null
}

/**
 * Who may see an appointment:
 *  - the patient it belongs to,
 *  - the doctor it's with,
 *  - reception / managers working at its clinic, and admins.
 */
export async function canViewAppointment(user: CurrentUser, appt: AppointmentAccessFacts): Promise<boolean> {
  switch (user.role) {
    case "patient":
      return appt.patientUserId === user.id
    case "doctor":
      return (await getDoctorIdForUser(user.id)) === appt.doctorId
    case "receptionist":
    case "manager":
    case "admin":
      return scopeIncludes(await getClinicScope(user), appt.clinicId)
  }
}
