import type { z } from "zod"

/** Every server action returns this shape; forms map `fieldErrors` back onto their fields. */
export type ActionResult<T = undefined, E = never> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; code?: string; details?: E }

export function fromZodError(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return { ok: false, error: "Please check the highlighted fields.", fieldErrors }
}
