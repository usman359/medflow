import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { db, schema } from "@/db"

export const auth = betterAuth({
  appName: "MedFlow",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  // No cookie cache: every request re-reads the session row, so a role change
  // or revoked session takes effect immediately (strict RBAC over a saved query).
  user: {
    additionalFields: {
      // `input: false` means sign-up and update-user requests can never set it;
      // roles are only assigned by an admin through a server action.
      role: { type: "string", required: false, defaultValue: "patient", input: false },
    },
  },
  // Must stay last: lets server actions that call auth.api set cookies.
  plugins: [nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
