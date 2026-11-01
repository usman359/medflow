"use client"

import { CalendarDays, Home, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/account", label: "Overview", icon: Home },
  { href: "/account/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/account/profile", label: "Profile", icon: UserRound },
]

export function AccountNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:grid">
      {ITEMS.map((item) => {
        const active = item.href === "/account" ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[0.95rem] font-medium text-foreground/80 hover:bg-accent hover:text-foreground",
              active && "bg-secondary text-secondary-foreground hover:bg-secondary"
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
