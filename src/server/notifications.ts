import "server-only"
import { eq } from "drizzle-orm"
import { db, type DbOrTx } from "@/db"
import { notifications } from "@/db/schema"

export type NotificationInput = {
  userId: string
  type:
    | "appointment_requested"
    | "appointment_confirmed"
    | "appointment_cancelled"
    | "appointment_checked_in"
    | "appointment_completed"
    | "appointment_no_show"
    | "appointment_reminder"
  title: string
  body: string
  link?: string
}

/**
 * Writes the in-app notification inside the caller's transaction and returns
 * a function that sends the matching email. Call that function only after the
 * transaction commits, so a rolled-back change never emails anyone.
 */
export async function createNotification(conn: DbOrTx, input: NotificationInput, email?: string | null) {
  const [row] = await conn
    .insert(notifications)
    .values({ userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link })
    .returning({ id: notifications.id })

  return async function deliver() {
    if (!email) return
    try {
      const sent = await sendEmail({ to: email, subject: input.title, text: emailText(input) })
      if (sent) await db.update(notifications).set({ emailSentAt: new Date() }).where(eq(notifications.id, row.id))
    } catch (error) {
      // Email is best-effort; the in-app notification is already stored.
      console.error("[notifications] email delivery failed", error)
    }
  }
}

function emailText(input: NotificationInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return [input.body, input.link ? `\nView it here: ${appUrl}${input.link}` : "", "\n— MedFlow"].join("\n")
}

type Email = { to: string; subject: string; text: string }

/** Sends via Resend when RESEND_API_KEY is set; otherwise logs to the console (development). */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`)
    return false
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "MedFlow <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
  })
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`)
  return true
}
