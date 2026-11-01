import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/dashboard/page-header"
import { EmptyState } from "@/components/illustrations/empty-state"
import { AvailabilityPanel } from "@/components/settings/availability-panel"
import { ClinicsPanel } from "@/components/settings/clinics-panel"
import { DoctorsPanel } from "@/components/settings/doctors-panel"
import { ServicesPanel } from "@/components/settings/services-panel"
import { db } from "@/db"
import { clinics as clinicsTable } from "@/db/schema"
import { loadSettingsParams, SETTINGS_TABS, type SettingsTab } from "@/lib/search-params/settings"
import { cn } from "@/lib/utils"
import { requireRole } from "@/server/auth"
import {
  loadDoctorAvailability,
  loadManagedClinics,
  loadManagedDoctors,
  loadSpecialtiesAndServices,
} from "@/server/settings/queries"

export const metadata: Metadata = { title: "Clinic settings" }

const TAB_LABELS: Record<SettingsTab, string> = {
  clinics: "Clinics",
  doctors: "Doctors",
  services: "Services",
  availability: "Availability",
}

export default async function SettingsPage({ searchParams }: PageProps<"/staff/manager/settings">) {
  const user = await requireRole("manager", "admin")
  const { tab, doctor: doctorParam } = await loadSettingsParams(searchParams)
  const managed = await loadManagedClinics(user)

  const header = (
    <PageHeader
      title="Clinic settings"
      description={
        user.role === "admin"
          ? "Clinics, doctors, services and working hours across the group."
          : "Manage your clinics, their doctors and working hours."
      }
    />
  )

  if (managed.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No clinic assigned to your account"
          description="Ask a system administrator to assign you to a clinic so you can manage it."
        />
      </>
    )
  }

  let content: React.ReactNode = null

  if (tab === "clinics") {
    content = <ClinicsPanel clinics={managed} canCreate={user.role === "admin"} />
  } else if (tab === "services") {
    const { specialties, services } = await loadSpecialtiesAndServices()
    content = <ServicesPanel services={services} specialties={specialties} />
  } else {
    const [doctors, allClinics] = await Promise.all([loadManagedDoctors(user), db.select().from(clinicsTable)])
    const managedIds = managed.map((c) => c.id)

    if (tab === "doctors") {
      const { specialties, services } = await loadSpecialtiesAndServices()
      content = (
        <DoctorsPanel
          doctors={doctors}
          clinicNames={Object.fromEntries(allClinics.map((c) => [c.id, c.name]))}
          specialtyNames={Object.fromEntries(specialties.map((s) => [s.id, s.name]))}
          catalog={{
            managedClinicIds: managedIds,
            clinics: allClinics
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => ({ value: c.id, label: c.name })),
            specialties: specialties.map((s) => ({ value: s.id, label: s.name })),
            services: services
              .filter((s) => s.isActive)
              .map((s) => ({
                value: s.id,
                label: s.name,
                specialtyId: s.specialtyId,
                hint: `${s.durationMinutes} min`,
              })),
          }}
        />
      )
    } else {
      const selected = doctors.find((d) => d.id === doctorParam) ?? null
      const availability = selected ? await loadDoctorAvailability(user, selected.id) : { rules: [], exceptions: [] }
      const tzById = new Map(allClinics.map((c) => [c.id, c.timezone]))
      const defaultTz = managed.find((c) => selected?.clinicIds.includes(c.id))?.timezone ?? managed[0].timezone
      content = (
        <AvailabilityPanel
          selectedId={selected?.id ?? null}
          doctors={doctors.map((d) => ({
            id: d.id,
            name: d.name,
            clinics: managed.filter((c) => d.clinicIds.includes(c.id)).map((c) => ({ id: c.id, name: c.name })),
          }))}
          rules={availability.rules}
          exceptions={availability.exceptions
            .filter((e) => !e.clinicId || managedIds.includes(e.clinicId))
            .map((e) => ({
              id: e.id,
              clinicName: e.clinicName,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              reason: e.reason,
              timezone: (e.clinicId && tzById.get(e.clinicId)) || defaultTz,
            }))}
        />
      )
    }
  }

  return (
    <>
      {header}
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b pb-3">
        {SETTINGS_TABS.map((t) => (
          <Link
            key={t}
            href={`/staff/manager/settings?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-accent",
              t === tab && "border-primary bg-primary text-primary-foreground hover:bg-primary"
            )}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>
      {content}
    </>
  )
}
