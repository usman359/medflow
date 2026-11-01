"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { isRole, ROLE_HOME } from "@/lib/domain"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { signInSchema, type SignInInput } from "@/lib/validation/auth"

export function SignInForm({ next, onSuccess }: { next?: string; onSuccess?: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })

  async function onSubmit(values: SignInInput) {
    setFormError(null)
    const { data, error } = await authClient.signIn.email(values)
    if (error || !data) {
      setFormError(
        error?.status === 401 || error?.status === 400
          ? "That email and password don't match our records."
          : "We couldn't sign you in right now. Please try again."
      )
      return
    }
    if (onSuccess) return onSuccess()
    const role = isRole(data.user.role) ? data.user.role : "patient"
    router.push(safeRedirectPath(next, ROLE_HOME[role]))
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div aria-live="polite">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </div>
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email", errors.email?.message)}
          {...register("email")}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", errors.password?.message)}
          {...register("password")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      {!onSuccess && (
        <p className="text-center text-sm text-muted-foreground">
          New to MedFlow?{" "}
          <Link
            href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </form>
  )
}
