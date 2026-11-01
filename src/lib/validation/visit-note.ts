import { z } from "zod"

export const visitNoteSchema = z.object({
  appointmentId: z.uuid(),
  body: z.string().trim().min(1, "Write a note before saving").max(8000, "Notes can be up to 8,000 characters"),
})
export type VisitNoteInput = z.infer<typeof visitNoteSchema>
