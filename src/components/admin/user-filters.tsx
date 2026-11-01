"use client"

import { Loader2, Search, X } from "lucide-react"
import { debounce, useQueryStates } from "nuqs"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_LABELS, ROLES } from "@/lib/domain"
import { adminSearchParams } from "@/lib/search-params/admin"

export function UserFilters() {
  const [pending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(adminSearchParams, { shallow: false, startTransition })
  const active = Boolean(filters.q || filters.role)

  return (
    <form
      role="search"
      aria-label="Filter users"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="au-q">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="au-q"
            type="search"
            placeholder="Name or email"
            className="pl-9"
            value={filters.q}
            onChange={(e) =>
              setFilters(
                { q: e.target.value || null, page: null },
                { limitUrlUpdates: e.target.value ? debounce(300) : undefined }
              )
            }
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="au-role">Role</Label>
        <Select
          value={filters.role ?? "all"}
          onValueChange={(v) => setFilters({ role: v === "all" ? null : (v as (typeof ROLES)[number]), page: null })}
        >
          <SelectTrigger id="au-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex h-9 items-center gap-2">
        {active && (
          <Button type="button" variant="ghost" onClick={() => setFilters({ q: null, role: null, page: null })}>
            <X aria-hidden="true" /> Clear
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
      </div>
    </form>
  )
}
