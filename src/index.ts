import { Elysia } from "elysia";
import { authPublic } from "./modules/auth";
import { userModule } from "./modules/user";
import { scheduleModule } from "./modules/schedules";

const app = new Elysia()
  .get("/", () => ({
    name: "Time Flow API",
    version: "1.0",
    docs: {
      user: "GET/PATCH /user/profile, /user/settings",
      schedules: "GET/POST/PATCH/DELETE /schedules",
      auth: "POST /auth/register (dev)",
    },
  }))
  .use(authPublic)
  .use(userModule)
  .use(scheduleModule)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
