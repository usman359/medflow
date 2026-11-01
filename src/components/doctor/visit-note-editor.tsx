"use client"

import { Loader2, NotebookPen } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveVisitNoteAction } from "@/server/appointments/note-actions"

const MAX = 8000

export function VisitNoteEditor({
  appointmentId,
  initialBody,
  editable,
  savedAt,
}: {
  appointmentId: string
  initialBody: string
  /** False until the patient has checked in. */
  editable: boolean
  savedAt?: string | null
}) {
  const router = useRouter()
  const [body, setBody] = useState(initialBody)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = body.trim() !== initialBody.trim()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveVisitNoteAction({ appointmentId, body })
      if (result.ok) {
        toast.success("Visit note saved")
        router.refresh()
      } else {
        setError(result.fieldErrors?.body?.[0] ?? result.error)
      }
    })
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={`note-${appointmentId}`} className="flex items-center gap-1.5">
        <NotebookPen className="size-4" aria-hidden="true" /> Visit note
      </Label>
      <Textarea
        id={`note-${appointmentId}`}
        rows={8}
        maxLength={MAX}
        value={body}
        disabled={!editable || pending}
        onChange={(e) => setBody(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `note-${appointmentId}-error` : `note-${appointmentId}-hint`}
        placeholder={editable ? "Findings, diagnosis, plan, follow-up…" : "Notes open once the patient has checked in."}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`note-${appointmentId}-hint`} className="text-sm text-muted-foreground">
          {error
            ? null
            : savedAt && !dirty
              ? `Saved ${savedAt}`
              : `${body.length.toLocaleString()} / ${MAX.toLocaleString()}`}
        </p>
        {error && (
          <p id={`note-${appointmentId}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="button" onClick={save} disabled={!editable || pending || !dirty || !body.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </div>
  )
}
