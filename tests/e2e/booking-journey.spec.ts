import "../../src/db/load-env"
import { expect, test, type Page } from "@playwright/test"
import { eq, inArray, like } from "drizzle-orm"
import { db } from "../../src/db"
import { appointments, auditEvents, notifications, patients, user, visitNotes } from "../../src/db/schema"
import { authFile } from "./helpers"

/**
 * The whole product in one story, using three different people:
 *
 *   1. A brand-new patient finds Dr. Morales, books online, and creates an
 *      account on the way. Riverside doesn't auto-confirm, so it's "Requested".
 *   2. Reception at Riverside finds the request, confirms it, and checks the
 *      patient in.
 *   3. Dr. Morales opens it, writes a visit note and completes the visit.
 *   4. The patient sees the finished appointment in their account.
 *
 * It creates its own patient and appointment and deletes both afterwards.
 */
test.describe.configure({ mode: "serial" })

const stamp = Date.now().toString(36)
const patient = {
  name: `E2E Patient ${stamp}`,
  email: `e2e-${stamp}@example.com`,
  password: "e2e-password-123",
  phone: "(617) 555-0188",
  dob: "1988-03-14",
}

let reference = ""
let appointmentDate = "" // YYYY-MM-DD in the clinic's timezone

/** "Thursday, October 8, 2026" → "2026-10-08" */
function toIsoDate(text: string) {
  const d = new Date(text)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The full journey runs on desktop; layout is covered on mobile elsewhere."
  )
})

test.afterAll(async () => {
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, `e2e-${stamp}@%`))
  if (!u) return
  const [p] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, u.id))
  if (p) {
    const appts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.patientId, p.id))
    const ids = appts.map((a) => a.id)
    if (ids.length) {
      await db.delete(visitNotes).where(inArray(visitNotes.appointmentId, ids))
      await db.delete(auditEvents).where(inArray(auditEvents.entityId, ids))
      await db.delete(appointments).where(inArray(appointments.id, ids))
    }
    await db.delete(patients).where(eq(patients.id, p.id))
  }
  await db.delete(notifications).where(eq(notifications.userId, u.id))
  await db.delete(auditEvents).where(eq(auditEvents.entityId, u.id))
  await db.delete(user).where(eq(user.id, u.id)) // cascades accounts and sessions
  await db.$client.end()
})

const row = (page: Page) => page.locator("table tbody tr", { hasText: patient.name })

test("a new patient books Dr. Morales online and creates an account on the way", async ({ page }) => {
  await page.goto("/doctors/elena-morales")
  await expect(page.getByRole("heading", { name: "Dr. Elena Morales" })).toBeVisible()

  // Start the booking from her profile and choose the service she offers.
  await page.getByRole("link", { name: "See all times" }).click()
  await expect(page.getByRole("heading", { name: /what would you like to see/i })).toBeVisible()
  await page
    .getByRole("link", { name: /Cardiology consultation/ })
    .first()
    .click()

  // Pick a day and time. The calendar preselects the first available day.
  await expect(page.getByRole("heading", { name: "Pick a date and time" })).toBeVisible()
  await page
    .getByRole("list")
    .locator("a", { hasText: /\d{1,2}:\d{2} [AP]M/ })
    .first()
    .click()

  // Signed out: create an account without leaving the flow.
  await expect(page.getByRole("heading", { name: "Create an account or sign in" })).toBeVisible()
  await page.getByLabel("Full name").fill(patient.name)
  await page.getByLabel("Email").fill(patient.email)
  await page.getByLabel("Password", { exact: true }).fill(patient.password)
  await page.getByLabel("Confirm password").fill(patient.password)
  await page.getByRole("button", { name: "Create account" }).click()

  // Details, then review.
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible()
  await page.getByLabel("Date of birth").fill(patient.dob)
  await page.getByLabel("Mobile number").fill(patient.phone)
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("heading", { name: "Review and confirm" })).toBeVisible()
  await expect(page.getByText("Dr. Elena Morales").first()).toBeVisible()
  // Leaving the reason empty is caught before anything is sent.
  await page.getByRole("button", { name: "Confirm booking" }).click()
  await expect(page.getByText("Tell the doctor briefly why you're coming in")).toBeVisible()

  await page.getByLabel("Reason for your visit").fill("Occasional palpitations when climbing stairs")
  await page.getByRole("button", { name: "Confirm booking" }).click()

  // Confirmation: Riverside leaves online bookings for reception to confirm.
  await expect(page.getByRole("heading", { name: "Booking request received" })).toBeVisible()
  reference = (await page.locator("p", { hasText: "Reference" }).locator("span").first().innerText()).trim()
  expect(reference).toMatch(/^MF-[A-Z0-9]{6}$/)
  appointmentDate = toIsoDate(
    await page
      .getByText(/^\w+day, \w+ \d{1,2}, \d{4}$/)
      .first()
      .innerText()
  )

  // The calendar file downloads and is a real event.
  const ics = await page.request.get(
    (await page.getByRole("link", { name: "Add to calendar" }).getAttribute("href")) as string
  )
  expect(ics.status()).toBe(200)
  const body = await ics.text()
  expect(body).toContain("BEGIN:VEVENT")
  expect(body).toContain(reference)

  await page.getByRole("link", { name: "View or manage" }).click()
  await expect(page.getByRole("heading", { name: "Cardiology consultation" })).toBeVisible()
  await expect(page.getByText("Waiting for the clinic to confirm")).toBeVisible()
})

test("reception finds the request, confirms it and checks the patient in", async ({ browser }) => {
  const context = await browser.newContext({ storageState: authFile("reception") })
  const page = await context.newPage()
  await page.goto(`/staff/reception?date=${appointmentDate}&q=${encodeURIComponent(patient.name)}`)

  await expect(row(page)).toBeVisible()
  await expect(row(page).getByText("Requested")).toBeVisible()
  await row(page).getByRole("button", { name: "Confirm", exact: true }).click()
  await expect(row(page).getByText("Confirmed")).toBeVisible()

  await row(page).getByRole("button", { name: "Check in" }).click()
  await expect(row(page).getByText("Checked in")).toBeVisible()
  // Only the next legal step is on offer.
  await expect(row(page).getByRole("button", { name: "Mark completed" })).toBeVisible()
  await expect(row(page).getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0)
  await context.close()
})

test("the doctor adds a visit note and completes the visit", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const api = context.request
  const { signInViaApi } = await import("./helpers")
  await signInViaApi(api, baseURL!, "elena.morales@medflow.test")
  const page = await context.newPage()

  await page.goto(`/staff/doctor?date=${appointmentDate}`)
  await page.getByRole("link", { name: new RegExp(patient.name) }).click()

  const drawer = page.getByRole("dialog")
  await expect(drawer.getByRole("heading", { name: patient.name })).toBeVisible()
  await expect(drawer.getByText("Occasional palpitations when climbing stairs")).toBeVisible()
  await expect(drawer.getByText("This is their first visit with you.")).toBeVisible()

  await drawer.getByLabel("Visit note").fill("Resting ECG normal. Advised to reduce caffeine; review in six weeks.")
  await drawer.getByRole("button", { name: "Save note" }).click()
  await expect(drawer.getByText(/^Saved /)).toBeVisible()

  await drawer.getByRole("button", { name: "Mark completed" }).click()
  await expect(drawer.getByText("Completed").first()).toBeVisible()
  await expect(drawer.getByRole("button", { name: "Mark completed" })).toHaveCount(0)
  await context.close()
})

test("the patient sees the finished visit, and can't change it", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const { signInViaApi } = await import("./helpers")
  await signInViaApi(context.request, baseURL!, patient.email, patient.password)
  const page = await context.newPage()

  await page.goto("/account/appointments?tab=past")
  await page.getByRole("link", { name: /Cardiology consultation/ }).click()
  await expect(page.getByText("Completed").first()).toBeVisible()
  await expect(page.getByText(reference)).toBeVisible()
  await expect(page.getByRole("button", { name: "Cancel appointment" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: /Book again with/ })).toBeVisible()
  await context.close()
})

test("someone else can't book the time that was just taken", async ({ browser, baseURL }) => {
  // The first patient's appointment now holds the slot, so a second person following a link to that
  // exact time must be told it's gone and must not see it offered.
  const [booked] = await db
    .select({ startsAt: appointments.startsAt })
    .from(appointments)
    .where(eq(appointments.reference, reference))
  const context = await browser.newContext({ baseURL })
  const { signInViaApi } = await import("./helpers")
  await signInViaApi(context.request, baseURL!, "patient@medflow.test")
  const page = await context.newPage()

  await page.goto(
    `/book?doctor=elena-morales&service=cardiology-consultation&clinic=riverside&date=${appointmentDate}&slot=${encodeURIComponent(booked.startsAt.toISOString())}`
  )
  await expect(page.getByRole("heading", { name: "Pick a date and time" })).toBeVisible()
  await expect(page.getByText("That time is no longer available")).toBeVisible()
  // Nothing on the page offers that exact start time any more.
  const offered = await page
    .getByRole("list")
    .locator("a", { hasText: /^\d{1,2}:\d{2} [AP]M$/ })
    .allInnerTexts()
  const bookedLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(booked.startsAt)
  expect(offered).not.toContain(bookedLabel)
  await context.close()
})
