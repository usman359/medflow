import { Skeleton } from "@/components/ui/skeleton"

/** Page-title placeholder shared by the dashboard loading states. */
export function HeaderSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  )
}

export function ListSkeleton({ rows = 5, className = "h-20" }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`${className} w-full rounded-2xl`} />
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="grid gap-3 rounded-3xl border bg-card p-3">
          <Skeleton className="aspect-4/5 w-full rounded-2xl" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
      ))}
    </div>
  )
}

/** Announces loading to assistive tech while the visual skeleton is hidden from it. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
