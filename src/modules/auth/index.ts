import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-min-32-characters-long";

/**
 * Public auth routes: register, sign-in
 */
export const authPublic = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
      exp: "7d",
    })
  )
  .post(
    "/register",
    async ({ body, jwt: sign }) => {
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

      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const [user] = await db
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          bufferMinutes: body.bufferMinutes ?? 15,
          timezone: body.timezone ?? "Asia/Jakarta",
        })
        .returning();

      const token = await sign.sign({
        sub: user!.id,
        email: user!.email,
      });

      return {
        id: user!.id,
        email: user!.email,
        token,
        message: "Use Authorization: Bearer <token> for API calls",
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        bufferMinutes: t.Optional(t.Number({ minimum: 5, maximum: 45 })),
        timezone: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/sign-in",
    async ({ body, jwt: sign }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email));

      if (!user || !user.passwordHash) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401 }
        );
      }

      const valid = await Bun.password.verify(body.password, user.passwordHash, {
        algorithm: "bcrypt",
      });

      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401 }
        );
      }

      const token = await sign.sign({
        sub: user.id,
        email: user.email,
      });

      return {
        id: user.id,
        email: user.email,
        token,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  );

/**
 * Auth plugin: verifies JWT from Authorization Bearer header
 */
export const authPlugin = new Elysia({ name: "auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
    })
  )
  .derive(async ({ request, jwt: verify }) => {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return {
        user: null as {
          id: string;
          email: string;
          bufferMinutes: number;
          timezone: string;
          sleepStart: string;
        } | null,
        authError: new Response(
          JSON.stringify({
            error: "Unauthorized: missing Authorization Bearer token",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    const payload = await verify.verify(token);

    if (!payload || !payload.sub) {
      return {
        user: null,
        authError: new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub as string));

    if (!user) {
      return {
        user: null,
        authError: new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        bufferMinutes: user.bufferMinutes,
        timezone: user.timezone,
        sleepStart: user.sleepStart,
      },
      authError: null as Response | null,
    };
  })
  .onBeforeHandle(({ authError }) => {
    if (authError) return authError;
  })
  .onBeforeHandle(({ user }) => {
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  });
