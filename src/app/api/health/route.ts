import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"

/** Safe readiness probe — never returns secret values, only whether they are present. */
export async function GET() {
  const databaseUrl = Boolean(process.env.DATABASE_URL)
  const betterAuthSecret = Boolean(process.env.BETTER_AUTH_SECRET)
  const betterAuthUrl = Boolean(process.env.BETTER_AUTH_URL)
  const appUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL)

  let database: "ok" | "missing_url" | "error" = "missing_url"
  let databaseError: string | undefined

  if (databaseUrl) {
    try {
      const { db } = await import("@/db")
      await db.execute(sql`select 1`)
      database = "ok"
    } catch (error) {
      database = "error"
      databaseError = error instanceof Error ? error.message : "unknown"
    }
  }

  const ok = database === "ok" && betterAuthSecret
  return NextResponse.json(
    {
      ok,
      env: { databaseUrl, betterAuthSecret, betterAuthUrl, appUrl },
      database,
      ...(databaseError ? { databaseError } : {}),
      deployment: process.env.VERCEL_URL ?? null,
      envTarget: process.env.VERCEL_ENV ?? null,
    },
    { status: ok ? 200 : 503 }
  )
}
