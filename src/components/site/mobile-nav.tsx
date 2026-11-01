"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ROLE_HOME, type Role } from "@/lib/domain"
import { PUBLIC_NAV } from "./nav-links"

export function MobileNav({ role }: { role: Role | null }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,90vw)]">
        <SheetHeader>
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="grid gap-1 px-4">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-base font-medium hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 p-4">
          <Button asChild size="lg">
            <Link href="/book" onClick={close}>
              Book an appointment
            </Link>
          </Button>
          {role ? (
            <Button asChild size="lg" variant="outline">
              <Link href={ROLE_HOME[role]} onClick={close}>
                {role === "patient" ? "My account" : "Dashboard"}
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in" onClick={close}>
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
