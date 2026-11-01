import { inArray } from "drizzle-orm"
import { cookies } from "next/headers"
import { UserMenu } from "@/components/site/user-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { db } from "@/db"
import { clinics } from "@/db/schema"
import { getClinicScope, type CurrentUser } from "@/server/auth"
import { AppSidebar } from "./app-sidebar"

export async function StaffShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [cookieStore, scope] = await Promise.all([cookies(), getClinicScope(user)])
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const clinicNames =
    scope === "all"
      ? ("all" as const)
      : scope.length
        ? (await db.select({ name: clinics.name }).from(clinics).where(inArray(clinics.id, scope))).map((c) =>
            c.name.replace(/^MedFlow\s+/, "")
          )
        : []

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar role={user.role} clinicNames={clinicNames} />
      <SidebarInset id="main">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <div className="ml-auto">
            <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
