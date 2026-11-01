"use client"

import { CalendarDays, LayoutDashboard, LogOut, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/domain"

export type MenuUser = { name: string; email: string; role: Role }

export function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function UserMenu({ user, align = "end" }: { user: MenuUser; align?: "start" | "end" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function signOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut()
      if (error) {
        toast.error("We couldn't sign you out. Please try again.")
        return
      }
      router.push("/")
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 rounded-full px-1.5 sm:pr-3" aria-label="Open account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium text-foreground">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs font-medium text-coral-ink">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {user.role === "patient" ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/account/appointments">
                  <CalendarDays /> My appointments
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/profile">
                  <UserRound /> Profile
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={ROLE_HOME[user.role]}>
                <LayoutDashboard /> Dashboard
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={pending}>
          <LogOut /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
