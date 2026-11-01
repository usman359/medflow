import type { APIRequestContext, Page } from "@playwright/test"

export const DEMO_PASSWORD = "medflow-demo-2026"

export const ACCOUNTS = {
  patient: "patient@medflow.test",
  reception: "reception@medflow.test", // Riverside only
  doctor: "doctor@medflow.test", // Dr. Rahim Khan
  elena: "elena.morales@medflow.test", // Dr. Elena Morales (Riverside, no auto-confirm)
  manager: "manager@medflow.test", // Riverside + Midtown
  admin: "admin@medflow.test",
} as const
export type AccountKey = keyof typeof ACCOUNTS

export const authFile = (key: AccountKey) => `playwright/.auth/${key}.json`

/** Signs in through the auth API (faster than the form). Retries once if the auth rate limiter says to slow down. */
export async function signInViaApi(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password = DEMO_PASSWORD
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
      headers: { Origin: baseURL },
    })
    if (res.ok()) return
    if (res.status() !== 429) throw new Error(`Sign-in failed for ${email}: ${res.status()} ${await res.text()}`)
    await new Promise((r) => setTimeout(r, 11_000))
  }
  throw new Error(`Sign-in for ${email} kept hitting the rate limit`)
}

/** No horizontal scrollbar: the page is never wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  return overflow
}
