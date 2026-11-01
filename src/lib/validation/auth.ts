import { z } from "zod"

/** Trims and lower-cases first, so a stray space from autofill doesn't make a valid address "invalid". */
export const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"))

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(100),
    email: emailField,
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
export type SignUpInput = z.infer<typeof signUpSchema>
