import { StaffShell } from "@/components/dashboard/staff-shell"
import { STAFF_ROLES } from "@/lib/domain"
import { requireRole } from "@/server/auth"

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const user = await requireRole(...STAFF_ROLES)
  return <StaffShell user={user}>{children}</StaffShell>
}
