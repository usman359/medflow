import { requireRole } from "@/server/auth"

export default async function ManagerLayout({ children }: LayoutProps<"/staff/manager">) {
  await requireRole("manager", "admin")
  return children
}
