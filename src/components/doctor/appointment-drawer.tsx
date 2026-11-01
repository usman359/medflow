"use client"

import { Clock, MapPin, Phone, Video } from "lucide-react"
import { useRouter } from "next/navigation"
import { Fact } from "@/components/facts"
import { StatusActions } from "@/components/appointments/status-actions"
import { StatusBadge } from "@/components/status-badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AppointmentStatus, ConsultationType } from "@/lib/domain"
import { VisitNoteEditor } from "./visit-note-editor"

export type DrawerAppointment = {
  id: string
  reference: string
  status: AppointmentStatus
  consultationType: ConsultationType
  reason: string
  service: string | null
  when: string
  clinic: string
  patient: { name: string; phone: string; age: number | null; dob: string | null }
  /** True once the patient has checked in (or the visit is done). */
  notesOpen: boolean
  note: string
  noteSavedAt: string | null
  transitions: AppointmentStatus[]
  history: {
    id: string
    when: string
    status: AppointmentStatus
    service: string | null
    reason: string
    note: string | null
  }[]
}

/**
 * Appointment details beside the schedule. Open state lives in the URL
 * (`?appt=`), so the drawer can be linked to and survives a refresh.
 */
export function AppointmentDrawer({ appt, closeHref }: { appt: DrawerAppointment; closeHref: string }) {
  const router = useRouter()
  return (
    <Sheet open onOpenChange={(open) => !open && router.push(closeHref, { scroll: false })}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-xl">{appt.patient.name}</SheetTitle>
            <StatusBadge status={appt.status} />
          </div>
          <SheetDescription>
            {appt.service ?? "Appointment"} · reference <span className="font-mono">{appt.reference}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4 pb-6">
          <div className="grid gap-3 rounded-2xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
            <Fact icon={Clock} label="When" hideLabel className="gap-2">
              <dd className="font-medium">{appt.when}</dd>
            </Fact>
            <Fact icon={appt.consultationType === "video" ? Video : MapPin} label="Where" hideLabel className="gap-2">
              <dd className="font-medium">{appt.consultationType === "video" ? "Video call" : appt.clinic}</dd>
            </Fact>
            <Fact icon={Phone} label="Phone" hideLabel className="gap-2">
              <dd>
                <a href={`tel:${appt.patient.phone.replace(/[^\d+]/g, "")}`} className="font-medium hover:underline">
                  {appt.patient.phone}
                </a>
              </dd>
            </Fact>
            <Fact label="Patient" hideLabel>
              <dd className="text-muted-foreground">
                {appt.patient.age !== null ? `${appt.patient.age} years` : "Age not recorded"}
                {appt.patient.dob ? ` · born ${appt.patient.dob}` : ""}
              </dd>
            </Fact>
          </div>

          <section aria-labelledby="reason-title" className="grid gap-1">
            <h3 id="reason-title" className="text-sm font-semibold text-muted-foreground uppercase">
              Reason for visit
            </h3>
            <p>{appt.reason}</p>
          </section>

          {appt.transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <StatusActions appointmentId={appt.id} status={appt.status} transitions={appt.transitions} />
            </div>
          )}

          <VisitNoteEditor
            key={`${appt.id}:${appt.noteSavedAt ?? "new"}`}
            appointmentId={appt.id}
            initialBody={appt.note}
            editable={appt.notesOpen}
            savedAt={appt.noteSavedAt}
          />

          <section aria-labelledby="history-title" className="grid gap-2">
            <h3 id="history-title" className="text-sm font-semibold text-muted-foreground uppercase">
              Previous visits with you
            </h3>
            {appt.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">This is their first visit with you.</p>
            ) : (
              <ul className="divide-y rounded-2xl border">
                {appt.history.map((h) => (
                  <li key={h.id} className="grid gap-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {h.when}
                        {h.service ? ` · ${h.service}` : ""}
                      </span>
                      <StatusBadge status={h.status} />
                    </div>
                    <p className="text-muted-foreground">{h.reason}</p>
                    {h.note && <p className="mt-1 rounded-lg bg-muted/60 p-2 whitespace-pre-wrap">{h.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
