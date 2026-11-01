"use client"

import { addDays, format } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react"
import { debounce, useQueryStates } from "nuqs"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { APPOINTMENT_STATUSES, STATUS_LABELS, type AppointmentStatus } from "@/lib/domain"
import { receptionSearchParams } from "@/lib/search-params/reception"
import { cn } from "@/lib/utils"

const ALL = "all"

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function ReceptionToolbar({
  today,
  date,
  clinics,
  doctors,
  counts,
}: {
  /** Today's date (YYYY-MM-DD) in the user's clinic timezone. */
  today: string
  /** The day being shown (YYYY-MM-DD). */
  date: string
  clinics: { slug: string; name: string }[]
  doctors: { slug: string; name: string }[]
  counts: Partial<Record<AppointmentStatus, number>>
}) {
  const [pending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(receptionSearchParams, { shallow: false, startTransition })
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
  const isToday = date === today
  const go = (ymd: string) => setFilters({ date: ymd === today ? null : ymd })
  const shift = (days: number) => go(format(addDays(parseYmd(date), days), "yyyy-MM-dd"))
  const active = Boolean(filters.q || filters.clinic || filters.doctor || filters.status)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border bg-card">
          <Button type="button" variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous day">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Label htmlFor="rx-date" className="sr-only">
            Date
          </Label>
          <Input
            id="rx-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="h-9 w-40 border-0 shadow-none focus-visible:ring-0"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next day">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <Button type="button" variant={isToday ? "secondary" : "outline"} onClick={() => go(today)} disabled={isToday}>
          <CalendarDays aria-hidden="true" /> Today
        </Button>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
      </div>

      <form
        role="search"
        aria-label="Filter appointments"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="rx-q">Search patient</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="rx-q"
              type="search"
              placeholder="Name, phone or reference"
              className="pl-9"
              value={filters.q}
              onChange={(e) =>
                setFilters(
                  { q: e.target.value || null },
                  { limitUrlUpdates: e.target.value ? debounce(300) : undefined }
                )
              }
            />
          </div>
        </div>
        {clinics.length > 1 && (
          <FilterSelect
            id="rx-clinic"
            label="Clinic"
            allLabel="All clinics"
            value={filters.clinic}
            onChange={(v) => setFilters({ clinic: v })}
            options={clinics.map((c) => ({ value: c.slug, label: c.name.replace(/^MedFlow\s+/, "") }))}
          />
        )}
        <FilterSelect
          id="rx-doctor"
          label="Doctor"
          allLabel="All doctors"
          value={filters.doctor}
          onChange={(v) => setFilters({ doctor: v })}
          options={doctors.map((d) => ({ value: d.slug, label: d.name }))}
        />
        <div className="flex h-9 items-center">
          {active && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFilters({ q: null, clinic: null, doctor: null, status: null })}
            >
              <X aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </form>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Chip selected={!filters.status} onClick={() => setFilters({ status: null })}>
          All <Count n={total} selected={!filters.status} />
        </Chip>
        {APPOINTMENT_STATUSES.map((s) => (
          <Chip
            key={s}
            selected={filters.status === s}
            onClick={() => setFilters({ status: filters.status === s ? null : s })}
          >
            {STATUS_LABELS[s]} <Count n={counts[s] ?? 0} selected={filters.status === s} />
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "border-primary bg-primary text-primary-foreground hover:bg-primary"
      )}
    >
      {children}
    </button>
  )
}

function Count({ n, selected }: { n: number; selected: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-xs font-semibold tabular-nums",
        selected ? "bg-white/20" : "bg-muted text-muted-foreground"
      )}
    >
      {n}
    </span>
  )
}

function FilterSelect({
  id,
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  allLabel: string
  value: string | null
  onChange: (value: string | null) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
