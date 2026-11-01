import { requireRole } from "@/server/auth"

export default async function DoctorLayout({ children }: LayoutProps<"/staff/doctor">) {
  await requireRole("doctor")
  return children
}
