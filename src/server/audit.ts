import "server-only"
import { auditEvents } from "@/db/schema"
import type { DbOrTx } from "@/db"
import type { Role } from "@/lib/domain"

export type AuditInput = {
  actor: { id: string; role: Role } | null
  entityType: "appointment" | "patient" | "clinic" | "doctor" | "service" | "availability" | "user"
  entityId: string
  action: string
  fromStatus?: string | null
  toStatus?: string | null
  metadata?: Record<string, unknown>
}

/** Appends an audit event. Call inside the same transaction as the change it records. */
export async function recordAudit(conn: DbOrTx, input: AuditInput) {
  await conn.insert(auditEvents).values({
    actorUserId: input.actor?.id ?? null,
    actorRole: input.actor?.role ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    metadata: input.metadata,
  })
}
