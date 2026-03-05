import { Elysia, t } from "elysia";
import { db } from "../../../db";
import { jsonError, successObj } from "../../utils/response";
import { users } from "../../../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-min-32-characters-long";
/** Durasi trial AI (jam) untuk user baru. Default 12. Env: AI_TRIAL_HOURS */
const AI_TRIAL_HOURS = Number(process.env.AI_TRIAL_HOURS) || 12;
if (
  !process.env.JWT_SECRET &&
  (process.env.NODE_ENV === "production" || process.env.BUN_ENV === "production")
) {
  console.warn(
    "⚠️  JWT_SECRET not set in production. Using fallback is UNSAFE. Set JWT_SECRET in environment."
  );
}

/**
 * Public auth routes: register, sign-in
 */
export const authPublic = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, jwt: sign }) => {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email));

      if (existing) {
        return jsonError(400, "Email sudah terdaftar", undefined, undefined, "BAD_REQUEST");
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
          aiAccessEnabled: true,
          aiAccessExpiresAt: new Date(Date.now() + AI_TRIAL_HOURS * 60 * 60 * 1000),
        })
        .returning();

      const token = await sign.sign({
        sub: user!.id,
        email: user!.email,
      });

      return successObj(
        { id: user!.id, email: user!.email, token },
        "Registrasi berhasil"
      );
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        bufferMinutes: t.Optional(t.Number({ minimum: 5, maximum: 45 })),
        timezone: t.Optional(t.String()),
      }),
      detail: {
        summary: "Register new user",
        description: "Create a new account. Returns JWT token for API authentication.",
        tags: ["Auth"],
      },
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
        return jsonError(401, "Email atau password salah", undefined, undefined, "UNAUTHORIZED");
      }

      const valid = await Bun.password.verify(body.password, user.passwordHash, "bcrypt");

      if (!valid) {
        return jsonError(401, "Email atau password salah", undefined, undefined, "UNAUTHORIZED");
      }

      const token = await sign.sign({
        sub: user.id,
        email: user.email,
      });

      return successObj(
        { id: user.id, email: user.email, token },
        "Login berhasil"
      );
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
      detail: {
        summary: "Sign in",
        description: "Authenticate and get JWT token. Use Bearer token for protected endpoints.",
        tags: ["Auth"],
      },
    }
  );

/** Auth derive + onBeforeHandle - export untuk dipakai di app level */
export const authGuard = {
  derive: async (ctx: { request: Request; jwt: { verify: (t: string) => Promise<unknown> | false } }) => {
    const { request, jwt: verify } = ctx;
    const path = new URL(request.url).pathname;
    const isPublic = path === "/" || path.startsWith("/auth") || path.startsWith("/docs");
    if (isPublic) {
      return { user: null as AuthUser | null, authError: null as Response | null };
    }
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return {
        user: null as AuthUser,
        authError: jsonError(401, "Token tidak ditemukan", "Sertakan Authorization: Bearer <token>", undefined, "UNAUTHORIZED"),
      };
    }

    let payload: { sub?: string; email?: string } | null = null;
    try {
      payload = (await verify.verify(token)) as { sub?: string; email?: string } | null;
    } catch (err) {
      console.warn("[auth] JWT verify failed:", err instanceof Error ? err.message : err);
      return {
        user: null,
        authError: jsonError(401, "Token tidak valid atau sudah kadaluarsa", undefined, undefined, "UNAUTHORIZED"),
      };
    }

    if (!payload || !payload.sub) {
      return {
        user: null,
        authError: jsonError(401, "Token tidak valid atau sudah kadaluarsa", undefined, undefined, "UNAUTHORIZED"),
      };
    }

    const sub = String(payload.sub);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, sub));

    if (!user) {
      return {
        user: null,
        authError: jsonError(401, "User tidak ditemukan", undefined, undefined, "NOT_FOUND"),
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        bufferMinutes: user.bufferMinutes,
        timezone: user.timezone,
        sleepStart: user.sleepStart,
        aiAccessEnabled: user.aiAccessEnabled,
        aiAccessExpiresAt: user.aiAccessExpiresAt,
      },
      authError: null as Response | null,
    };
  },
  onBeforeHandle: (ctx: { request: Request; authError: Response | null; user: { id: string } | null }) => {
    const { request, authError, user } = ctx;
    if (authError) return authError;
    const path = new URL(request.url).pathname;
    const isPublic = path === "/" || path.startsWith("/auth") || path.startsWith("/docs");
    if (isPublic) return;
    if (!user) {
      return jsonError(401, "Unauthorized", undefined, undefined, "UNAUTHORIZED");
    }
  },
};

/** Type for authenticated user - use in handler params when app-level derive provides it */
export type AuthUser = {
  id: string;
  email: string;
  bufferMinutes: number;
  timezone: string;
  sleepStart: string;
  aiAccessEnabled: boolean;
  aiAccessExpiresAt: Date | null;
} | null;

