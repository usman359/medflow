import Link from "next/link"
import { Logo } from "@/components/brand/logo"

const COLUMNS = [
  {
    title: "Patients",
    links: [
      { href: "/book", label: "Book an appointment" },
      { href: "/doctors", label: "Find a doctor" },
      { href: "/services", label: "Services & prices" },
      { href: "/account", label: "My account" },
    ],
  },
  {
    title: "Clinics",
    links: [
      { href: "/#locations", label: "Boston · Riverside" },
      { href: "/#locations", label: "New York · Midtown" },
      { href: "/#locations", label: "Chicago · Lakeshore" },
    ],
  },
  {
    title: "Staff",
    links: [{ href: "/sign-in?next=/staff/reception", label: "Staff sign in" }],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-sand/60">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Friendly, joined-up care across our clinics. Book online any time, or call your clinic and our reception
            team will help.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="grid content-start gap-2 text-sm">
            <h2 className="mb-1 text-sm font-semibold text-teal-900">{col.title}</h2>
            {col.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="w-fit text-muted-foreground hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="container-page py-5 text-sm text-muted-foreground">
          © {new Date().getFullYear()} MedFlow Health Group. In an emergency, call 911.
        </p>
      </div>
    </footer>
  )
}
