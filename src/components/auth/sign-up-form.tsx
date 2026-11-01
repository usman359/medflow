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
import { safeRedirectPath } from "@/lib/safe-redirect"
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth"

export function SignUpForm({ next, onSuccess }: { next?: string; onSuccess?: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  async function onSubmit({ name, email, password }: SignUpInput) {
    setFormError(null)
    const { error } = await authClient.signUp.email({ name, email, password })
    if (error) {
      if (error.code === "USER_ALREADY_EXISTS" || error.status === 422) {
        setError("email", { message: "An account with this email already exists. Try signing in instead." })
      } else {
        setFormError(error.message ?? "We couldn't create your account. Please try again.")
      }
      return
    }
    // New accounts are always patients; staff accounts are created by an administrator.
    if (onSuccess) return onSuccess()
    router.push(safeRedirectPath(next, "/account"))
    router.refresh()
  }

  const fields = [
    { name: "name", label: "Full name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    {
      name: "password",
      label: "Password",
      type: "password",
      autoComplete: "new-password",
      hint: "At least 8 characters.",
    },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ] as const

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div aria-live="polite">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </div>
      {fields.map((field) => {
        const error = errors[field.name]?.message
        const hint = "hint" in field ? field.hint : undefined
        return (
          <FormField key={field.name} id={field.name} label={field.label} error={error} hint={hint}>
            <Input
              id={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              aria-invalid={!!error}
              aria-describedby={describedBy(field.name, error, hint)}
              {...register(field.name)}
            />
          </FormField>
        )
      })}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Creating your account…" : "Create account"}
      </Button>
      {!onSuccess && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </form>
  )
}
