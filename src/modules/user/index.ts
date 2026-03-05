import { Elysia } from "elysia";
import { UserService } from "./service";
import { userModels } from "./model";
import { jsonError, successObj } from "../../utils/response";

export const userModule = new Elysia({
  prefix: "/user",
  detail: {
    tags: ["User"],
    security: [{ bearerAuth: [] }],
  },
})
  .model(userModels)
  .get(
    "/profile",
    async ({ user }) => {
      if (!user?.id) {
        return jsonError(401, "Unauthorized", "Token invalid atau user tidak ditemukan", undefined, "UNAUTHORIZED");
      }
      try {
        const profile = await UserService.getById(user.id);
        if (!profile) {
          return jsonError(404, "User tidak ditemukan", undefined, undefined, "NOT_FOUND");
        }
        return successObj({
          id: profile.id,
          email: profile.email,
          bufferMinutes: profile.bufferMinutes,
          timezone: profile.timezone,
          sleepStart: profile.sleepStart,
          aiAccessEnabled: profile.aiAccessEnabled,
          aiAccessExpiresAt: profile.aiAccessExpiresAt?.toISOString() ?? null,
          aiAccessPermanent: profile.aiAccessExpiresAt === null && profile.aiAccessEnabled,
        });
      } catch (err) {
        console.error("[user/profile]", err);
        return jsonError(
          500,
          "Gagal memuat profil",
          err instanceof Error ? err.message : "Database error",
          undefined,
          "SERVER_ERROR"
        );
      }
    },
  {
    detail: {
      summary: "Get profile",
      description: "Returns the authenticated user's profile and settings.",
    },
  }
)
  .patch(
    "/settings",
    async ({ user, body }) => {
      if (!user?.id) {
        return jsonError(401, "Unauthorized", "Token invalid atau user tidak ditemukan", undefined, "UNAUTHORIZED");
      }
      const updated = await UserService.updateSettings(user.id, body);
      if (!updated) {
        return jsonError(500, "Gagal memperbarui pengaturan", undefined, undefined, "SERVER_ERROR");
      }
      return successObj(
        {
          bufferMinutes: updated.bufferMinutes,
          timezone: updated.timezone,
          sleepStart: updated.sleepStart,
        },
        "Pengaturan berhasil disimpan"
      );
    },
    {
      body: "settingsBody",
      detail: {
        summary: "Update settings",
        description: "Update buffer minutes, timezone, and sleep start time.",
      },
    }
  );
