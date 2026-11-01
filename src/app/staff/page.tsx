import { redirect } from "next/navigation"
import { ROLE_HOME, STAFF_ROLES } from "@/lib/domain"
import { requireRole } from "@/server/auth"

export default async function StaffIndex() {
  const user = await requireRole(...STAFF_ROLES)
  redirect(ROLE_HOME[user.role])
}
