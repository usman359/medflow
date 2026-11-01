"use client"

import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  Settings2,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoMark } from "@/components/brand/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ROLE_LABELS, type Role } from "@/lib/domain"

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] }

/** Navigation is derived from the role so nobody sees links they can't open. */
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      {
        href: "/staff/reception",
        label: "Appointments",
        icon: ClipboardList,
        roles: ["receptionist", "manager", "admin"],
      },
      { href: "/staff/doctor", label: "My schedule", icon: CalendarClock, roles: ["doctor"] },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/staff/manager/reports", label: "Reports", icon: BarChart3, roles: ["manager", "admin"] },
      { href: "/staff/manager/settings", label: "Clinic settings", icon: Settings2, roles: ["manager", "admin"] },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/admin", label: "Users & roles", icon: Users, roles: ["admin"] }],
  },
]

export function AppSidebar({ role, clinicNames }: { role: Role; clinicNames: string[] | "all" }) {
  const pathname = usePathname()
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((item) => item.roles.includes(role)) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="MedFlow">
              <Link href="/">
                <LogoMark className="size-8 shrink-0" />
                <span className="grid leading-tight">
                  <span className="font-semibold text-teal-900">MedFlow</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Stethoscope className="size-3.5" aria-hidden="true" /> Clinics
            </span>
            <span className="mt-0.5 block">
              {clinicNames === "all"
                ? "All clinics"
                : clinicNames.length
                  ? clinicNames.join(", ")
                  : "No clinic assigned"}
            </span>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Public site">
              <Link href="/">
                <ExternalLink />
                <span>Public site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
