import { Elysia, t } from "elysia";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Public auth routes (no auth required): register for dev/testing
 */
export const authPublic = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body }) => {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email));

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Email already registered" }),
          { status: 400 }
        );
      }

      const [user] = await db
        .insert(users)
        .values({
          email: body.email,
          bufferMinutes: body.bufferMinutes ?? 15,
          timezone: body.timezone ?? "Asia/Jakarta",
        })
        .returning();

      return {
        id: user!.id,
        email: user!.email,
        message: "Use x-user-id header with this id for API calls",
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        bufferMinutes: t.Optional(t.Number({ minimum: 5, maximum: 45 })),
        timezone: t.Optional(t.String()),
      }),
    }
  );

/**
 * Auth plugin: derives user from x-user-id header (dev) or Authorization Bearer.
 * Phase 1: Uses x-user-id for development. JWT can be added in Phase 2.
 */
export const authPlugin = new Elysia({ name: "auth" })
  .derive(async ({ request }) => {
    const userId =
      request.headers.get("x-user-id") ??
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!userId) {
      return {
        user: null as { id: string; email: string; bufferMinutes: number; timezone: string } | null,
        authError: new Response(
          JSON.stringify({ error: "Unauthorized: missing x-user-id or Authorization header" }),
          { status: 401 }
        ),
      };
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return {
        user: null,
        authError: new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 401 }
        ),
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        bufferMinutes: user.bufferMinutes,
        timezone: user.timezone,
      },
      authError: null as Response | null,
    };
  })
  .onBeforeHandle(({ user, authError }) => {
    if (authError) return authError;
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }
  });
