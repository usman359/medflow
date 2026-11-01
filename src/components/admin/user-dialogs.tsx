"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Pencil, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm, useWatch, type Control } from "react-hook-form"
import { toast } from "sonner"
import { describedBy, FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_LABELS, ROLES, STAFF_ROLES, type Role } from "@/lib/domain"
import {
  newStaffSchema,
  resetPasswordSchema,
  STAFF_PASSWORD_MIN,
  updateAccessSchema,
  type NewStaffInput,
  type NewStaffOutput,
  type ResetPasswordInput,
  type UpdateAccessInput,
  type UpdateAccessOutput,
} from "@/lib/validation/admin"
import { createStaffUserAction, resetPasswordAction, updateUserAccessAction } from "@/server/admin/actions"
import type { AdminUserRow } from "@/server/admin/queries"
import { applyActionError, CheckboxGroup, FormActions, FormDialog } from "@/components/settings/form-kit"

export type AdminOptions = {
  clinics: { id: string; name: string }[]
  doctors: { id: string; name: string; userId: string | null }[]
}

const ROLE_HELP: Record<Role, string> = {
  patient: "Can book and manage their own appointments only.",
  receptionist: "Works the front desk at the clinics you choose.",
  doctor: "Sees only their own schedule and patients.",
  manager: "Reports and settings for the clinics you choose.",
  admin: "Full access, including users and roles.",
}

/** Role-dependent fields shared by "edit access" and "add staff". */
function AccessFields({
  control,
  options,
  userId,
  roles,
  errors,
}: {
  control: Control<UpdateAccessInput & NewStaffInput>
  options: AdminOptions
  /** The login being edited, so its own doctor profile stays selectable. */
  userId: string | null
  roles: readonly Role[]
  errors: { clinicIds?: string; doctorId?: string }
}) {
  const role = useWatch({ control, name: "role" }) as Role

  return (
    <>
      <FormField id="acc-role" label="Role" hint={ROLE_HELP[role]}>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="acc-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      {(role === "receptionist" || role === "manager") && (
        <Controller
          control={control}
          name="clinicIds"
          render={({ field }) => (
            <CheckboxGroup
              legend="Clinics"
              hint="They can only see and act on these clinics."
              options={options.clinics.map((c) => ({ value: c.id, label: c.name }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.clinicIds}
            />
          )}
        />
      )}

      {role === "doctor" && (
        <FormField
          id="acc-doctor"
          label="Doctor profile"
          error={errors.doctorId}
          hint="The profile whose schedule this login manages."
        >
          <Controller
            control={control}
            name="doctorId"
            render={({ field }) => (
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <SelectTrigger id="acc-doctor" className="w-full">
                  <SelectValue placeholder="Choose a doctor profile" />
                </SelectTrigger>
                <SelectContent>
                  {options.doctors
                    .filter((d) => !d.userId || d.userId === userId)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}
    </>
  )
}

function EditAccessForm({
  user,
  options,
  isSelf,
  onDone,
}: {
  user: AdminUserRow
  options: AdminOptions
  isSelf: boolean
  onDone: () => void
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<UpdateAccessInput, unknown, UpdateAccessOutput>({
    resolver: zodResolver(updateAccessSchema),
    defaultValues: { userId: user.id, role: user.role, clinicIds: user.clinicIds, doctorId: user.doctorId ?? "" },
  })
  const { control, handleSubmit, setError, formState } = form

  async function onSubmit() {
    setFormError(null)
    const result = await updateUserAccessAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success(`Access updated for ${user.name}`)
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {isSelf && (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          This is your own account, so you can&apos;t remove your admin access.
        </p>
      )}
      <AccessFields
        control={control as unknown as Control<UpdateAccessInput & NewStaffInput>}
        options={options}
        userId={user.id}
        roles={isSelf ? (["admin"] as const) : ROLES}
        errors={{
          clinicIds: formState.errors.clinicIds?.message as string | undefined,
          doctorId: formState.errors.doctorId?.message as string | undefined,
        }}
      />
      <FormActions pending={formState.isSubmitting} label="Save access" />
    </form>
  )
}

function NewStaffForm({ options, onDone }: { options: AdminOptions; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<NewStaffInput, unknown, NewStaffOutput>({
    resolver: zodResolver(newStaffSchema),
    defaultValues: { name: "", email: "", password: "", role: "receptionist", clinicIds: [], doctorId: "" },
  })
  const { register, control, handleSubmit, setError, formState } = form
  const { errors } = formState

  async function onSubmit() {
    setFormError(null)
    const result = await createStaffUserAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success("Staff account created. Share the password with them securely.")
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="ns-name" label="Full name" error={errors.name?.message}>
        <Input id="ns-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField id="ns-email" label="Email" error={errors.email?.message}>
        <Input id="ns-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
      </FormField>
      <FormField
        id="ns-password"
        label="Starting password"
        error={errors.password?.message}
        hint={`At least ${STAFF_PASSWORD_MIN} characters. Share it securely; you can reset it later.`}
      >
        <Input
          id="ns-password"
          type="text"
          autoComplete="off"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("ns-password", errors.password?.message, "hint")}
          {...register("password")}
        />
      </FormField>
      <AccessFields
        control={control as unknown as Control<UpdateAccessInput & NewStaffInput>}
        options={options}
        userId={null}
        roles={STAFF_ROLES}
        errors={{
          clinicIds: errors.clinicIds?.message as string | undefined,
          doctorId: errors.doctorId?.message as string | undefined,
        }}
      />
      <FormActions pending={formState.isSubmitting} label="Create account" />
    </form>
  )
}

function ResetPasswordForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { userId: user.id, password: "" },
  })
  const { register, handleSubmit, setError, formState } = form

  async function onSubmit() {
    setFormError(null)
    const result = await resetPasswordAction(form.getValues())
    if (!result.ok) return setFormError(applyActionError(result, setError))
    toast.success(`Password reset for ${user.name}. They've been signed out everywhere.`)
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField
        id="rp-password"
        label="New password"
        error={formState.errors.password?.message}
        hint={`At least ${STAFF_PASSWORD_MIN} characters. They'll be signed out on every device.`}
      >
        <Input
          id="rp-password"
          type="text"
          autoComplete="off"
          aria-invalid={!!formState.errors.password}
          {...register("password")}
        />
      </FormField>
      <FormActions pending={formState.isSubmitting} label="Reset password" />
    </form>
  )
}

export function EditAccessDialog(props: { user: AdminUserRow; options: AdminOptions; isSelf: boolean }) {
  return (
    <FormDialog
      title={`Access for ${props.user.name}`}
      description={props.user.email}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil aria-hidden="true" /> Edit<span className="sr-only"> access for {props.user.name}</span>
        </Button>
      }
    >
      {(close) => <EditAccessForm {...props} onDone={close} />}
    </FormDialog>
  )
}

export function NewStaffDialog({ options }: { options: AdminOptions }) {
  return (
    <FormDialog
      title="Add a staff account"
      description="Patients create their own accounts. Use this for reception, doctors, managers and administrators."
      trigger={
        <Button>
          <UserPlus aria-hidden="true" /> Add staff
        </Button>
      }
    >
      {(close) => <NewStaffForm options={options} onDone={close} />}
    </FormDialog>
  )
}

export function ResetPasswordDialog({ user }: { user: AdminUserRow }) {
  return (
    <FormDialog
      title={`Reset password for ${user.name}`}
      description={user.email}
      trigger={
        <Button variant="ghost" size="sm">
          <KeyRound aria-hidden="true" /> Reset password<span className="sr-only"> for {user.name}</span>
        </Button>
      }
    >
      {(close) => <ResetPasswordForm user={user} onDone={close} />}
    </FormDialog>
  )
}
