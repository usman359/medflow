import { cn } from "@/lib/utils"

/**
 * A horizontally scrollable container that keyboard users can reach and scroll
 * (arrow keys), with an accessible name so it's announced as a region.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      {children}
    </div>
  )
}
