import { expect, test } from "@playwright/test"
import { authFile } from "./helpers"

/**
 * Role-based access, checked the way an attacker would: by requesting URLs and
 * calling endpoints directly. A "403" here means the server refused, not just
 * that a link was hidden.
 */
const forbidden = async (page: import("@playwright/test").Page, path: string) => {
  const res = await page.goto(path)
  expect(res?.status(), `${path} should be forbidden`).toBe(403)
  await expect(page.getByRole("heading", { name: /don.t have access/i })).toBeVisible()
}

test.describe("signed out", () => {
  for (const path of [
    "/account",
    "/account/appointments",
    "/staff/reception",
    "/staff/doctor",
    "/staff/manager/reports",
    "/admin",
  ]) {
    test(`${path} sends visitors to sign in and remembers where they were going`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
      )
    })
  }

  test("API endpoints refuse anonymous callers", async ({ request }) => {
    expect((await request.get("/api/appointments/00000000-0000-4000-8000-000000000000/ics")).status()).toBe(401)
    expect((await request.get("/staff/manager/reports/export", { maxRedirects: 0 })).status()).toBe(307)
  })
})

test.describe("patient", () => {
  test.use({ storageState: authFile("patient") })

  for (const path of [
    "/staff/reception",
    "/staff/doctor",
    "/staff/manager/reports",
    "/staff/manager/settings",
    "/admin",
  ]) {
    test(`cannot open ${path}`, async ({ page }) => {
      await forbidden(page, path)
    })
  }

  test("cannot download another person's calendar file or the CSV export", async ({ request }) => {
    expect((await request.get("/api/appointments/00000000-0000-4000-8000-000000000000/ics")).status()).toBe(404)
    expect((await request.get("/staff/manager/reports/export")).status()).toBe(404)
  })

  test("sees a 404 for an appointment that isn't theirs, not a 403", async ({ page }) => {
    const res = await page.goto("/account/appointments/00000000-0000-4000-8000-000000000000")
    expect(res?.status()).toBe(404)
  })
})

test.describe("receptionist (Riverside)", () => {
  test.use({ storageState: authFile("reception") })

  for (const path of ["/staff/manager/reports", "/staff/manager/settings", "/staff/doctor", "/admin", "/account"]) {
    test(`cannot open ${path}`, async ({ page }) => {
      await forbidden(page, path)
    })
  }

  test("can't see another clinic's appointments by filtering for it", async ({ page }) => {
    await page.goto("/staff/reception?clinic=lakeshore")
    await expect(page.getByRole("heading", { name: /appointments/i }).first()).toBeVisible()
    await expect(page.locator("table tbody tr")).toHaveCount(0)
    await expect(page.getByText("Lakeshore")).toHaveCount(0)
  })

  test("the sidebar only offers what the role can open", async ({ page, isMobile }) => {
    await page.goto("/staff/reception")
    // On a phone the sidebar is a slide-out sheet, so open it first.
    if (isMobile)
      await page
        .getByRole("button", { name: /toggle sidebar/i })
        .first()
        .click()
    const nav = page.locator("[data-slot=sidebar-inner], [data-mobile=true]").first()
    await expect(nav.getByRole("link", { name: "Appointments" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Reports" })).toHaveCount(0)
    await expect(nav.getByRole("link", { name: "Users & roles" })).toHaveCount(0)
  })
})

test.describe("doctor", () => {
  test.use({ storageState: authFile("doctor") })

  for (const path of ["/staff/reception", "/staff/manager/reports", "/admin", "/account"]) {
    test(`cannot open ${path}`, async ({ page }) => {
      await forbidden(page, path)
    })
  }

  test("can open their own schedule", async ({ page }) => {
    const res = await page.goto("/staff/doctor")
    expect(res?.status()).toBe(200)
  })
})

test.describe("manager", () => {
  test.use({ storageState: authFile("manager") })

  test("can't open the admin area but can open reports and settings", async ({ page }) => {
    await forbidden(page, "/admin")
    expect((await page.goto("/staff/manager/reports"))?.status()).toBe(200)
    expect((await page.goto("/staff/manager/settings"))?.status()).toBe(200)
  })

  test("only sees their own clinics in settings", async ({ page }) => {
    await page.goto("/staff/manager/settings")
    await expect(page.getByRole("heading", { name: "MedFlow Riverside" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "MedFlow Midtown" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "MedFlow Lakeshore" })).toHaveCount(0)
  })

  test("the CSV export works and carries no patient details", async ({ request }) => {
    const res = await request.get("/staff/manager/reports/export?from=2026-09-01&to=2026-10-31")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("text/csv")
    const csv = await res.text()
    expect(csv.split("\r\n")[0]).toBe(
      "Reference,Date,Start,End,Clinic,Doctor,Specialty,Service,Visit type,Status,Booked via"
    )
    expect(csv).not.toMatch(/Lakeshore/) // out of scope
    expect(csv).not.toMatch(/@example\.com|\(\d{3}\) 555/) // no emails or phone numbers
  })
})

test.describe("administrator", () => {
  test.use({ storageState: authFile("admin") })

  test("can open the admin area and every clinic's settings", async ({ page }) => {
    expect((await page.goto("/admin"))?.status()).toBe(200)
    await page.goto("/staff/manager/settings")
    await expect(page.getByRole("heading", { name: "MedFlow Lakeshore" })).toBeVisible()
  })
})
