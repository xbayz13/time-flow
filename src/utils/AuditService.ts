import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { activityAuditLogs } from "../../db/schema";

type AuditSource = "AI" | "USER";

export type AuditLogEntry = {
  id: string;
  activityId: string | null;
  action: string;
  source: string;
  payloadBefore: Record<string, unknown> | null;
  payloadAfter: Record<string, unknown> | null;
  createdAt: Date;
};

export abstract class AuditService {
  static async getByUser(
    userId: string,
    limit = 50
  ): Promise<AuditLogEntry[]> {
    const rows = await db
      .select()
      .from(activityAuditLogs)
      .where(eq(activityAuditLogs.userId, userId))
      .orderBy(desc(activityAuditLogs.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      activityId: r.activityId,
      action: r.action,
      source: r.source,
      payloadBefore: r.payloadBefore ? (JSON.parse(r.payloadBefore) as Record<string, unknown>) : null,
      payloadAfter: r.payloadAfter ? (JSON.parse(r.payloadAfter) as Record<string, unknown>) : null,
      createdAt: r.createdAt,
    }));
  }
  static async logCreate(
    userId: string,
    activityId: string,
    source: AuditSource,
    payloadAfter: Record<string, unknown>
  ) {
    await db.insert(activityAuditLogs).values({
      userId,
      activityId,
      action: "CREATE",
      source,
      payloadBefore: null,
      payloadAfter: JSON.stringify(payloadAfter),
    });
  }

  static async logUpdate(
    userId: string,
    activityId: string,
    source: AuditSource,
    payloadBefore: Record<string, unknown>,
    payloadAfter: Record<string, unknown>
  ) {
    await db.insert(activityAuditLogs).values({
      userId,
      activityId,
      action: "UPDATE",
      source,
      payloadBefore: JSON.stringify(payloadBefore),
      payloadAfter: JSON.stringify(payloadAfter),
    });
  }

  static async logDelete(
    userId: string,
    activityId: string,
    source: AuditSource,
    payloadBefore: Record<string, unknown>
  ) {
    await db.insert(activityAuditLogs).values({
      userId,
      activityId,
      action: "DELETE",
      source,
      payloadBefore: JSON.stringify(payloadBefore),
      payloadAfter: null,
    });
  }
}
