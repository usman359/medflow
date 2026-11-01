import Link from "next/link"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8 17.5h4l2.2-5 3.6 9 2.2-4h4"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="10" r="2.4" className="fill-coral" />
    </svg>
  )
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 rounded-lg font-semibold text-teal-900", className)}
      aria-label="MedFlow home"
    >
      <LogoMark />
      <span className="text-xl tracking-tight">MedFlow</span>
    </Link>
  )
}
