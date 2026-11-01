import "server-only"
import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { clinics, doctors, staffClinics, user } from "@/db/schema"
import { isRole, type Role } from "@/lib/domain"

export const USERS_PAGE_SIZE = 25

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: Date
  clinicIds: string[]
  doctorId: string | null
  doctorName: string | null
}

export async function listUsers(filters: { q?: string; role?: Role | null; page?: number }) {
  const page = Math.max(1, filters.page ?? 1)
  const q = filters.q?.trim()
  const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%` : null
  const where: SQL | undefined = and(
    filters.role ? eq(user.role, filters.role) : undefined,
    pattern ? or(ilike(user.name, pattern), ilike(user.email, pattern)) : undefined
  )

  const [rows, [total]] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
      .from(user)
      .where(where)
      .orderBy(asc(user.name), asc(user.email))
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db.select({ n: count() }).from(user).where(where),
  ])

  const ids = rows.map((r) => r.id)
  const [assignments, linked] = ids.length
    ? await Promise.all([
        db.select().from(staffClinics),
        db.select({ id: doctors.id, name: doctors.name, userId: doctors.userId }).from(doctors),
      ])
    : [[], []]

  const users: AdminUserRow[] = rows.map((r) => {
    const doctor = linked.find((d) => d.userId === r.id)
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: isRole(r.role) ? r.role : "patient",
      createdAt: r.createdAt,
      clinicIds: assignments.filter((a) => a.userId === r.id).map((a) => a.clinicId),
      doctorId: doctor?.id ?? null,
      doctorName: doctor?.name ?? null,
    }
  })
  return { users, total: total.n, page, pages: Math.max(1, Math.ceil(total.n / USERS_PAGE_SIZE)) }
}

/** Clinics and doctor profiles an admin can attach to a login. */
export async function loadAdminOptions() {
  const [clinicRows, doctorRows] = await Promise.all([
    db.select({ id: clinics.id, name: clinics.name }).from(clinics).orderBy(asc(clinics.name)),
    db.select({ id: doctors.id, name: doctors.name, userId: doctors.userId }).from(doctors).orderBy(asc(doctors.name)),
  ])
  return {
    clinics: clinicRows,
    /** All doctors, with who (if anyone) already uses each profile. */
    doctors: doctorRows.map((d) => ({ id: d.id, name: d.name, userId: d.userId })),
    unlinkedDoctorCount: doctorRows.filter((d) => d.userId === null).length,
  }
}

export async function countAdmins(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(user).where(eq(user.role, "admin"))
  return row.n
}
