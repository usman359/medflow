import { requireRole } from "@/server/auth"

export default async function ReceptionLayout({ children }: LayoutProps<"/staff/reception">) {
  await requireRole("receptionist", "manager", "admin")
  return children
}
