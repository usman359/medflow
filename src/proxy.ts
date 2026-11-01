import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Optimistic gate only: checks that a session cookie exists, without touching
 * the database. Role and clinic checks happen in layouts and the DAL
 * (src/server/auth.ts), which is the real authorization boundary.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()

  const { pathname, search } = request.nextUrl
  const signIn = new URL("/sign-in", request.url)
  signIn.searchParams.set("next", pathname + search)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*", "/admin/:path*"],
}
