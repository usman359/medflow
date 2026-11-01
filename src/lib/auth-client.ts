import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { auth } from "@/server/better-auth"

// No baseURL: the client talks to /api/auth on whatever origin served the page.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
})

export const { signIn, signUp, signOut, useSession } = authClient
