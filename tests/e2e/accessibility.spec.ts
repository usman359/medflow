import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { authFile, expectNoHorizontalScroll, type AccountKey } from "./helpers"

/**
 * Automated WCAG 2.1 A/AA checks plus a responsive check on every main screen,
 * for each role. Runs on desktop and on a phone viewport (see the projects in
 * playwright.config.ts). Automated checks catch roughly a third of issues, so
 * this complements, rather than replaces, keyboard and screen-reader testing.
 */
const PAGES: { name: string; path: string; as?: AccountKey }[] = [
  { name: "home", path: "/" },
  { name: "doctors directory", path: "/doctors" },
  { name: "doctors directory, filtered", path: "/doctors?specialty=cardiology" },
  { name: "doctor profile", path: "/doctors/rahim-khan" },
  { name: "services", path: "/services" },
  { name: "booking: first step", path: "/book" },
  { name: "booking: pick a time", path: "/book?doctor=rahim-khan&service=general-consultation" },
  { name: "sign in", path: "/sign-in" },
  { name: "sign up", path: "/sign-up" },
  { name: "patient overview", path: "/account", as: "patient" },
  { name: "patient appointments", path: "/account/appointments", as: "patient" },
  { name: "patient profile", path: "/account/profile", as: "patient" },
  { name: "reception dashboard", path: "/staff/reception?date=2026-10-05", as: "reception" },
  { name: "doctor schedule (day)", path: "/staff/doctor?date=2026-10-05", as: "doctor" },
  { name: "doctor schedule (week)", path: "/staff/doctor?view=week&date=2026-10-05", as: "doctor" },
  { name: "manager reports", path: "/staff/manager/reports", as: "manager" },
  { name: "settings: clinics", path: "/staff/manager/settings", as: "manager" },
  { name: "settings: doctors", path: "/staff/manager/settings?tab=doctors", as: "manager" },
  { name: "settings: services", path: "/staff/manager/settings?tab=services", as: "manager" },
  { name: "admin users", path: "/admin", as: "admin" },
]

const settle = async (page: Page) => {
  await page.waitForLoadState("networkidle").catch(() => {})
  // Radix selects render their label after hydration.
  await page.waitForTimeout(500)
}

for (const entry of PAGES) {
  test.describe(entry.name, () => {
    if (entry.as) test.use({ storageState: authFile(entry.as) })

    test("has no WCAG A/AA violations", async ({ page }) => {
      const res = await page.goto(entry.path)
      expect(res?.status()).toBe(200)
      await settle(page)
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      const summary = results.violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join("\n    ")}`
      )
      expect(summary, summary.join("\n")).toEqual([])
    })

    test("fits the screen without sideways scrolling", async ({ page }) => {
      await page.goto(entry.path)
      await settle(page)
      expect(await expectNoHorizontalScroll(page)).toBeLessThanOrEqual(1)
    })
  })
}

test("the first Tab press on a public page offers a skip link", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard navigation is a desktop concern")
  await page.goto("/")
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
})
