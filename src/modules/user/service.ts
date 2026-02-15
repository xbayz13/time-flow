import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import type { User } from "../../../db/schema";

export abstract class UserService {
  static async getById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  static async updateSettings(
    userId: string,
    data: {
      bufferMinutes?: number;
      timezone?: string;
      sleepStart?: string;
    }
  ): Promise<User | undefined> {
    const updates: Partial<{ bufferMinutes: number; timezone: string; sleepStart: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (data.bufferMinutes !== undefined) updates.bufferMinutes = data.bufferMinutes;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.sleepStart !== undefined) updates.sleepStart = data.sleepStart;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    return updated;
  }
}
