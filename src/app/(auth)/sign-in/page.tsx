import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SignInForm } from "@/components/auth/sign-in-form"
import { ROLE_HOME } from "@/lib/domain"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { getCurrentUser } from "@/server/auth"

export const metadata: Metadata = { title: "Sign in" }

const DEMO_ACCOUNTS = ["patient", "reception", "doctor", "manager", "admin"]

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams
  const nextPath = typeof next === "string" ? safeRedirectPath(next, "") || undefined : undefined

  const user = await getCurrentUser()
  if (user) redirect(nextPath ?? ROLE_HOME[user.role])

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to manage your appointments.</p>
      </div>
      <SignInForm next={nextPath} />
      {process.env.NODE_ENV !== "production" && (
        <aside className="rounded-xl border border-dashed bg-muted/50 p-4 text-sm">
          <p className="font-medium">Demo accounts</p>
          <p className="mt-1 text-muted-foreground">
            {DEMO_ACCOUNTS.map((name, i) => (
              <span key={name}>
                <code className="text-foreground">{name}@medflow.test</code>
                {i < DEMO_ACCOUNTS.length - 1 ? ", " : ""}
              </span>
            ))}
            . Password: <code className="text-foreground">medflow-demo-2026</code>
          </p>
        </aside>
      )}
    </div>
  )
}
