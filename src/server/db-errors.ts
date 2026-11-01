/** Postgres error details, unwrapping Drizzle's DrizzleQueryError (which keeps the driver error in `cause`). */
export function pgError(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth++) {
    const e = current as { code?: unknown; constraint?: unknown; cause?: unknown }
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) {
      return { code: e.code, constraint: typeof e.constraint === "string" ? e.constraint : undefined }
    }
    current = e.cause
  }
  return {}
}

export const PG_UNIQUE_VIOLATION = "23505"
export const PG_EXCLUSION_VIOLATION = "23P01"
