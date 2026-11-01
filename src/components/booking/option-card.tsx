import { Check } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/** A selectable choice in the booking flow. It's a link, so choices work without JavaScript and live in the URL. */
export function OptionCard({
  href,
  selected,
  className,
  children,
}: {
  href: string
  selected?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm",
        selected && "border-primary bg-accent ring-1 ring-primary",
        className
      )}
    >
      {children}
      {selected && (
        <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" aria-hidden="true" />
          <span className="sr-only">Selected</span>
        </span>
      )}
    </Link>
  )
}
