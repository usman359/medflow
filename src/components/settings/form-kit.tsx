"use client"

import { useState } from "react"
import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ActionResult } from "@/lib/action-result"

/** A button that opens a dialog containing a form. The form gets `close` to dismiss it after saving. */
export function FormDialog({
  trigger,
  title,
  description,
  children,
  wide,
}: {
  trigger: React.ReactNode
  title: string
  description?: string
  children: (close: () => void) => React.ReactNode
  wide?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={`max-h-[92dvh] overflow-y-auto ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {/* Mounted only while open so each opening starts from the saved values. */}
        {open && children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  )
}

/** Puts server-side field errors onto the matching form fields and returns the form-level message. */
export function applyActionError<T extends FieldValues>(
  result: Extract<ActionResult<unknown, unknown>, { ok: false }>,
  setError: UseFormSetError<T>
): string {
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    setError(field as Path<T>, { message: messages[0] })
  }
  return result.error
}

/** A labelled group of checkboxes bound to an array of ids. */
export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  error,
  disabledValues = [],
  hint,
}: {
  legend: string
  options: { value: string; label: string; hint?: string }[]
  value: string[]
  onChange: (next: string[]) => void
  error?: string
  /** Options the user can see but not change (e.g. a clinic they don't manage). */
  disabledValues?: string[]
  hint?: string
}) {
  const toggle = (v: string, checked: boolean) => onChange(checked ? [...value, v] : value.filter((x) => x !== v))
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const id = `${legend}-${o.value}`.replace(/\W+/g, "-")
          return (
            <div key={o.value} className="flex items-start gap-2 rounded-lg border bg-card p-2.5">
              <Checkbox
                id={id}
                checked={value.includes(o.value)}
                disabled={disabledValues.includes(o.value)}
                onCheckedChange={(c) => toggle(o.value, c === true)}
                className="mt-0.5"
              />
              <Label htmlFor={id} className="grid gap-0.5 leading-snug font-normal">
                <span className="font-medium">{o.label}</span>
                {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
              </Label>
            </div>
          )
        })}
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </fieldset>
  )
}

export function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-3">
      <Label htmlFor={id} className="grid gap-0.5 leading-snug">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm font-normal text-muted-foreground">{description}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function FormActions({ pending, label, onCancel }: { pending: boolean; label: string; onCancel?: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </div>
  )
}
