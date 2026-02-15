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
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  }
}
