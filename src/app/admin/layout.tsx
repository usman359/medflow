import { StaffShell } from "@/components/dashboard/staff-shell"
import { requireRole } from "@/server/auth"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("admin")
  return <StaffShell user={user}>{children}</StaffShell>
}
