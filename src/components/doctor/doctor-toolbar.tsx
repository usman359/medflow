"use client"

import { addDays, format } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useQueryStates } from "nuqs"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { doctorScheduleParams } from "@/lib/search-params/doctor"
import { cn } from "@/lib/utils"

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function DoctorToolbar({ today, date }: { today: string; date: string }) {
  const [pending, startTransition] = useTransition()
  const [{ view }, setParams] = useQueryStates(doctorScheduleParams, { shallow: false, startTransition })
  const step = view === "week" ? 7 : 1
  const go = (ymd: string) => setParams({ date: ymd === today ? null : ymd, appt: null })
  const shift = (days: number) => go(format(addDays(parseYmd(date), days), "yyyy-MM-dd"))
  const onToday = date === today

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-lg border bg-card">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => shift(-step)}
          aria-label={view === "week" ? "Previous week" : "Previous day"}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Label htmlFor="dr-date" className="sr-only">
          Date
        </Label>
        <Input
          id="dr-date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="h-9 w-40 border-0 shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => shift(step)}
          aria-label={view === "week" ? "Next week" : "Next day"}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <Button type="button" variant={onToday ? "secondary" : "outline"} onClick={() => go(today)} disabled={onToday}>
        <CalendarDays aria-hidden="true" /> Today
      </Button>

      <div role="group" aria-label="View" className="ml-auto inline-flex rounded-lg bg-muted p-1 text-sm font-medium">
        {(["day", "week"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setParams({ view: v === "day" ? null : v, appt: null })}
            className={cn(
              "rounded-md px-4 py-1.5 text-foreground/70 capitalize focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              view === v && "bg-background text-foreground shadow-sm"
            )}
          >
            {v}
          </button>
        ))}
      </div>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
    </div>
  )
}
