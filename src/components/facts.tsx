import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One labelled fact beside an icon. Each fact is its own definition list, so the
 * markup stays valid (a <dl> may only contain dt/dd groups, not icons) while screen
 * readers still announce the label with its value. Children are the <dd> values.
 */
export function Fact({
  icon: Icon,
  label,
  hideLabel,
  className,
  children,
}: {
  icon?: LucideIcon
  label: string
  /** Keep the label for assistive tech only (the value is self-explanatory visually). */
  hideLabel?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />}
      <dl className="min-w-0">
        <dt className={cn("text-sm text-muted-foreground", hideLabel && "sr-only")}>{label}</dt>
        {children}
      </dl>
    </div>
  )
}
