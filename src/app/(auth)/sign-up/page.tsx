import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { ROLE_HOME } from "@/lib/domain"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { getCurrentUser } from "@/server/auth"

export const metadata: Metadata = { title: "Create an account" }

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams
  const nextPath = typeof next === "string" ? safeRedirectPath(next, "") || undefined : undefined

  const user = await getCurrentUser()
  if (user) redirect(nextPath ?? ROLE_HOME[user.role])

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="text-muted-foreground">Book and manage appointments at any MedFlow clinic.</p>
      </div>
      <SignUpForm next={nextPath} />
    </div>
  )
}
