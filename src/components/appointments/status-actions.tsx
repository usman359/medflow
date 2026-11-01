"use client"

import { Ban, CalendarCheck, CircleCheck, DoorOpen, Loader2, UserX, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { AppointmentStatus } from "@/lib/domain"
import { changeAppointmentStatusAction } from "@/server/appointments/actions"

type ActionMeta = {
  label: string
  icon: LucideIcon
  variant: "default" | "outline" | "destructive"
  /** Needs an explicit confirmation step (destructive or hard to undo). */
  confirm?: { title: string; description: string; button: string; askReason?: boolean }
  success: string
}

const META: Partial<Record<AppointmentStatus, ActionMeta>> = {
  confirmed: { label: "Confirm", icon: CalendarCheck, variant: "default", success: "Appointment confirmed" },
  checked_in: { label: "Check in", icon: DoorOpen, variant: "default", success: "Patient checked in" },
  completed: { label: "Mark completed", icon: CircleCheck, variant: "default", success: "Visit marked completed" },
  no_show: {
    label: "No-show",
    icon: UserX,
    variant: "outline",
    success: "Marked as no-show",
    confirm: {
      title: "Mark this patient as a no-show?",
      description: "This can't be undone. The time slot stays used.",
      button: "Mark no-show",
    },
  },
  cancelled: {
    label: "Cancel",
    icon: Ban,
    variant: "destructive",
    success: "Appointment cancelled",
    confirm: {
      title: "Cancel this appointment?",
      description: "The time becomes available to others and the patient is notified. This can't be undone.",
      button: "Yes, cancel appointment",
      askReason: true,
    },
  },
}

/** Buttons for the moves an actor may make. The server re-checks every one; this only decides what to show. */
export function StatusActions({
  appointmentId,
  status,
  transitions,
  size = "default",
  cancelLabel,
  audience = "staff",
}: {
  appointmentId: string
  /** Status the user is looking at; sent so a stale view gets a clear conflict instead of a surprise change. */
  status: AppointmentStatus
  transitions: AppointmentStatus[]
  size?: "default" | "sm"
  /** Wording for the cancel button, e.g. "Cancel appointment" for patients. */
  cancelLabel?: string
  /** Who is acting; changes the wording of the cancel confirmation. */
  audience?: "patient" | "staff"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<AppointmentStatus | null>(null)
  const [confirming, setConfirming] = useState<AppointmentStatus | null>(null)
  const [reason, setReason] = useState("")

  function run(to: AppointmentStatus, withReason?: string) {
    setBusy(to)
    startTransition(async () => {
      const result = await changeAppointmentStatusAction({
        appointmentId,
        to,
        expectedFrom: status,
        reason: withReason || undefined,
      })
      setBusy(null)
      if (result.ok) {
        toast.success(META[to]?.success ?? "Updated")
        setConfirming(null)
        setReason("")
      } else {
        toast.error(result.error)
        setConfirming(null)
      }
      router.refresh()
    })
  }

  const baseConfirm = confirming ? META[confirming]?.confirm : undefined
  const confirmMeta =
    baseConfirm && confirming === "cancelled" && audience === "patient"
      ? {
          ...baseConfirm,
          description: "The time is released for other patients, and the clinic is told. This can't be undone.",
        }
      : baseConfirm

  return (
    <>
      {transitions.map((to) => {
        const meta = META[to]
        if (!meta) return null
        const Icon = meta.icon
        const label = to === "cancelled" && cancelLabel ? cancelLabel : meta.label
        return (
          <Button
            key={to}
            type="button"
            size={size}
            variant={meta.variant}
            disabled={pending}
            onClick={() => (meta.confirm ? setConfirming(to) : run(to))}
          >
            {busy === to ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
            {label}
          </Button>
        )
      })}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && !pending && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMeta?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMeta?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmMeta?.askReason && (
            <div className="grid gap-2">
              <Label htmlFor={`reason-${appointmentId}`}>Reason (optional)</Label>
              <Textarea
                id={`reason-${appointmentId}`}
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Feeling better, work conflict"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep appointment</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => confirming && run(confirming, reason)}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {confirmMeta?.button}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
