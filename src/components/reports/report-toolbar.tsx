"use client"

import { addDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns"
import { Download, Loader2 } from "lucide-react"
import { useQueryStates } from "nuqs"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { reportSearchParams } from "@/lib/search-params/reports"
import { cn } from "@/lib/utils"

const ymd = (d: Date) => format(d, "yyyy-MM-dd")
const parse = (v: string) => {
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function ReportToolbar({
  today,
  from,
  to,
  clinic,
  clinics,
}: {
  today: string
  /** The range actually being shown (after defaults and clamping). */
  from: string
  to: string
  clinic: string | null
  clinics: { slug: string; name: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [, setParams] = useQueryStates(reportSearchParams, { shallow: false, startTransition })
  const now = parse(today)

  const presets = [
    { label: "Last 7 days", from: ymd(addDays(now, -6)), to: today },
    { label: "Last 30 days", from: ymd(addDays(now, -29)), to: today },
    { label: "Last 90 days", from: ymd(addDays(now, -89)), to: today },
    { label: "This month", from: ymd(startOfMonth(now)), to: today },
    { label: "Last month", from: ymd(startOfMonth(subMonths(now, 1))), to: ymd(endOfMonth(subMonths(now, 1))) },
  ]

  const exportQuery = new URLSearchParams({ from, to })
  if (clinic) exportQuery.set("clinic", clinic)

  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Date range presets" className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => setParams({ from: p.from, to: p.to })}
              className={cn(
                "rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <form aria-label="Report filters" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="rp-from">From</Label>
          <Input
            id="rp-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setParams({ from: e.target.value })}
            className="w-44"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rp-to">To</Label>
          <Input
            id="rp-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setParams({ to: e.target.value })}
            className="w-44"
          />
        </div>
        {clinics.length > 1 && (
          <div className="grid gap-2">
            <Label htmlFor="rp-clinic">Clinic</Label>
            <Select value={clinic ?? "all"} onValueChange={(v) => setParams({ clinic: v === "all" ? null : v })}>
              <SelectTrigger id="rp-clinic" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clinics</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name.replace(/^MedFlow\s+/, "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
          <Button asChild variant="outline">
            <a href={`/staff/manager/reports/export?${exportQuery}`} download>
              <Download aria-hidden="true" /> Export CSV
            </a>
          </Button>
        </div>
      </form>
    </div>
  )
}
