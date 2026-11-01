import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Label + control + hint/error, wired for screen readers. Give the control
 * `id={id}`, `aria-invalid={!!error}` and `aria-describedby={describedBy(id, error, hint)}`.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function describedBy(id: string, error?: string, hint?: React.ReactNode): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
