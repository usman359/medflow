import type { Metadata } from "next"
import { ProfileForm } from "@/components/account/profile-form"
import { PageHeader } from "@/components/dashboard/page-header"
import { requireRole } from "@/server/auth"
import { getPatientForUser } from "@/server/patients/queries"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const user = await requireRole("patient")
  const patient = await getPatientForUser(user.id)
  const [first, ...rest] = user.name.split(" ")

  return (
    <>
      <PageHeader
        title="Profile"
        description="These details are used when you book and are shared with your care team."
      />
      <section aria-labelledby="details-title" className="grid max-w-2xl gap-5 rounded-3xl border bg-card p-6">
        <h2 id="details-title" className="text-lg font-semibold">
          Your details
        </h2>
        <ProfileForm
          defaultValues={{
            firstName: patient?.firstName ?? first ?? "",
            lastName: patient?.lastName ?? rest.join(" "),
            dateOfBirth: patient?.dateOfBirth ?? "",
            phone: patient?.phone ?? "",
          }}
        />
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>. To change your email address,
          contact your clinic.
        </p>
      </section>
    </>
  )
}
