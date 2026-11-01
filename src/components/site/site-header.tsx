import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/server/auth"
import { MobileNav } from "./mobile-nav"
import { PUBLIC_NAV } from "./nav-links"
import { UserMenu } from "./user-menu"

export async function SiteHeader() {
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[0.95rem] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
          ) : (
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/book">Book appointment</Link>
          </Button>
          <MobileNav role={user?.role ?? null} />
        </div>
      </div>
    </header>
  )
}
