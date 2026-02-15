import { Elysia } from "elysia";
import { UserService } from "./service";
import { userModels } from "./model";
import { authPlugin } from "../auth";

export const userModule = new Elysia({
  prefix: "/user",
  detail: {
    tags: ["User"],
    security: [{ bearerAuth: [] }],
  },
})
  .use(authPlugin)
  .model(userModels)
  .get(
    "/profile",
    async ({ user }) => {
    const profile = await UserService.getById(user.id);
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }
    return {
      id: profile.id,
      email: profile.email,
      bufferMinutes: profile.bufferMinutes,
      timezone: profile.timezone,
      sleepStart: profile.sleepStart,
    };
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
      const updated = await UserService.updateSettings(user.id, body);
      if (!updated) {
        return new Response(
          JSON.stringify({ error: "Failed to update settings" }),
          { status: 500 }
        );
      }
      return {
        bufferMinutes: updated.bufferMinutes,
        timezone: updated.timezone,
        sleepStart: updated.sleepStart,
      };
    },
    {
      body: "settingsBody",
      detail: {
        summary: "Update settings",
        description: "Update buffer minutes, timezone, and sleep start time.",
      },
    }
  );
