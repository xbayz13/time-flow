import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../../../db";
import { activities } from "../../../db/schema";
import type { Activity, NewActivity } from "../../../db/schema";
import { ConflictManager } from "../../utils/ConflictManager";

export abstract class ScheduleService {
  static async getByDate(userId: string, date: string): Promise<Activity[]> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          lt(activities.startTime, dayEnd),
          gt(activities.endTime, dayStart)
        )
      )
      .orderBy(activities.startTime);
  }

  static async getById(id: string, userId: string): Promise<Activity | undefined> {
    const [act] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)));

    return act;
  }

  static async create(data: NewActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(data).returning();
    if (!created) throw new Error("Failed to create activity");
    return created;
  }

  static async update(
    id: string,
    userId: string,
    data: Partial<NewActivity>
  ): Promise<Activity | undefined> {
    const [updated] = await db
      .update(activities)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(activities.id, id), eq(activities.userId, userId)))
      .returning();

    return updated;
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(activities)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)));

    return (result.rowCount ?? 0) > 0;
  }

  static checkConflict(
    newSlot: { startTime: Date; endTime: Date; title: string; isFixed: boolean },
    existing: Activity[],
    bufferMinutes: number,
    excludeId?: string
  ) {
    const existingSlots = existing
      .filter((a) => a.id !== excludeId)
      .map((a) => ({
        title: a.title,
        startTime: new Date(a.startTime),
        endTime: new Date(a.endTime),
        isFixed: a.isFixed,
      }));

    return ConflictManager.check(
      {
        title: newSlot.title,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        isFixed: newSlot.isFixed,
      },
      existingSlots,
      bufferMinutes
    );
  }
}
