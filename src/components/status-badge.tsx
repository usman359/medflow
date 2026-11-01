import { Ban, CalendarCheck, CircleCheck, CircleDashed, DoorOpen, UserX } from "lucide-react"
import { STATUS_LABELS, type AppointmentStatus } from "@/lib/domain"
import { cn } from "@/lib/utils"

const STYLES: Record<AppointmentStatus, { className: string; icon: typeof Ban }> = {
  requested: { className: "bg-(--status-requested-bg) text-(--status-requested)", icon: CircleDashed },
  confirmed: { className: "bg-(--status-confirmed-bg) text-(--status-confirmed)", icon: CalendarCheck },
  checked_in: { className: "bg-(--status-checked-in-bg) text-(--status-checked-in)", icon: DoorOpen },
  completed: { className: "bg-(--status-completed-bg) text-(--status-completed)", icon: CircleCheck },
  cancelled: { className: "bg-(--status-cancelled-bg) text-(--status-cancelled)", icon: Ban },
  no_show: { className: "bg-(--status-no-show-bg) text-(--status-no-show)", icon: UserX },
}

/** Status pill: a distinct color *and* an icon and label, so status never relies on color alone. */
export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const { className: tone, icon: Icon } = STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}
