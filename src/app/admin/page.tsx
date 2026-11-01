import type { Metadata } from "next"
import Link from "next/link"
import { EditAccessDialog, NewStaffDialog, ResetPasswordDialog } from "@/components/admin/user-dialogs"
import { UserFilters } from "@/components/admin/user-filters"
import { PageHeader } from "@/components/dashboard/page-header"
import { ScrollRegion } from "@/components/scroll-region"
import { EmptyState } from "@/components/illustrations/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROLE_LABELS, type Role } from "@/lib/domain"
import { loadAdminParams } from "@/lib/search-params/admin"
import { requireRole } from "@/server/auth"
import { listUsers, loadAdminOptions, USERS_PAGE_SIZE } from "@/server/admin/queries"

export const metadata: Metadata = { title: "Users & roles" }

const ROLE_STYLE: Record<Role, string> = {
  patient: "bg-muted text-muted-foreground",
  receptionist: "bg-secondary text-secondary-foreground",
  doctor: "bg-(--status-checked-in-bg) text-(--status-checked-in)",
  manager: "bg-(--status-requested-bg) text-(--status-requested)",
  admin: "bg-coral-soft text-coral-ink",
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireRole("admin")
  const params = await loadAdminParams(searchParams)
  const [{ users, total, page, pages }, options] = await Promise.all([
    listUsers({ q: params.q, role: params.role, page: params.page }),
    loadAdminOptions(),
  ])
  const clinicName = new Map(options.clinics.map((c) => [c.id, c.name.replace(/^MedFlow\s+/, "")]))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set("q", params.q)
    if (params.role) qs.set("role", params.role)
    if (p > 1) qs.set("page", String(p))
    const s = qs.toString()
    return s ? `/admin?${s}` : "/admin"
  }

  return (
    <>
      <PageHeader
        title="Users & roles"
        description={`${total} ${total === 1 ? "account" : "accounts"} · assign roles, clinics and doctor profiles.`}
        actions={<NewStaffDialog options={options} />}
      />
      <UserFilters />

      {users.length === 0 ? (
        <EmptyState title="No users match" description="Try a different search or role." />
      ) : (
        <ScrollRegion label="User accounts" className="rounded-2xl border bg-card">
          <Table>
            <caption className="sr-only">User accounts</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Works at</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.name}</span>
                    {u.id === admin.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    <span className="block text-sm text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_STYLE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.role === "admin"
                      ? "All clinics"
                      : u.role === "doctor"
                        ? (u.doctorName ?? "No doctor profile linked")
                        : u.role === "patient"
                          ? "—"
                          : u.clinicIds
                              .map((id) => clinicName.get(id))
                              .filter(Boolean)
                              .join(", ") || "No clinic assigned"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <EditAccessDialog user={u} options={options} isSelf={u.id === admin.id} />
                      <ResetPasswordDialog user={u} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages} · showing {USERS_PAGE_SIZE} per page
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" disabled={page <= 1}>
              <Link href={pageHref(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" disabled={page >= pages}>
              <Link href={pageHref(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
                Next
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </>
  )
}
