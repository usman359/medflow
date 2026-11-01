import { cn } from "@/lib/utils"

/** Friendly inline illustration: a calendar with a magnifying glass. Decorative only. */
export function SearchCalendarIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" className={cn("h-28 w-auto", className)}>
      <ellipse cx="80" cy="108" rx="58" ry="6" className="fill-sand" />
      <rect x="28" y="20" width="84" height="76" rx="12" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="28" y="20" width="84" height="20" rx="12" className="fill-mint" />
      <rect x="28" y="32" width="84" height="8" className="fill-mint" />
      <circle cx="48" cy="20" r="4" className="fill-primary" />
      <circle cx="92" cy="20" r="4" className="fill-primary" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={40 + col * 16}
            y={50 + row * 14}
            width="10"
            height="8"
            rx="2"
            className={row === 1 && col === 2 ? "fill-coral" : "fill-teal-100"}
          />
        ))
      )}
      <circle cx="116" cy="72" r="16" className="fill-background stroke-primary" strokeWidth="5" />
      <path d="M128 84l12 12" className="stroke-primary" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({
  title,
  description,
  action,
  illustration = <SearchCalendarIllustration />,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  illustration?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center",
        className
      )}
    >
      {illustration}
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
