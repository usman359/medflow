"use client"

import { Loader2, Search, X } from "lucide-react"
import { debounce, useQueryStates } from "nuqs"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CONSULTATION_LABELS, CONSULTATION_TYPES } from "@/lib/domain"
import { doctorSearchParams } from "@/lib/search-params/doctors"

const ALL = "all"

export function DoctorFilters({
  specialties,
  clinics,
}: {
  specialties: { slug: string; name: string }[]
  clinics: { slug: string; name: string; city: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(doctorSearchParams, { shallow: false, startTransition })
  const active = Boolean(filters.q || filters.specialty || filters.clinic || filters.type)

  return (
    <form
      role="search"
      aria-label="Filter doctors"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="doctor-q">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="doctor-q"
            type="search"
            placeholder="Name or specialty"
            className="pl-9"
            value={filters.q}
            onChange={(e) =>
              setFilters({ q: e.target.value || null }, { limitUrlUpdates: e.target.value ? debounce(300) : undefined })
            }
          />
        </div>
      </div>
      <FilterSelect
        id="doctor-specialty"
        label="Specialty"
        value={filters.specialty}
        onChange={(v) => setFilters({ specialty: v })}
        allLabel="All specialties"
        options={specialties.map((s) => ({ value: s.slug, label: s.name }))}
      />
      <FilterSelect
        id="doctor-clinic"
        label="Clinic"
        value={filters.clinic}
        onChange={(v) => setFilters({ clinic: v })}
        allLabel="All clinics"
        options={clinics.map((c) => ({ value: c.slug, label: `${c.name.replace(/^MedFlow\s+/, "")} · ${c.city}` }))}
      />
      <FilterSelect
        id="doctor-type"
        label="Visit type"
        value={filters.type}
        onChange={(v) => setFilters({ type: v as (typeof CONSULTATION_TYPES)[number] | null })}
        allLabel="Any visit type"
        options={CONSULTATION_TYPES.map((t) => ({ value: t, label: CONSULTATION_LABELS[t] }))}
      />
      <div className="flex h-9 items-center gap-2">
        {active && (
          <Button type="button" variant="ghost" onClick={() => setFilters(null)}>
            <X aria-hidden="true" /> Clear
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" />}
      </div>
    </form>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  allLabel: string
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
