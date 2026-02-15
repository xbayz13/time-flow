import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { authPublic } from "./modules/auth";
import { userModule } from "./modules/user";
import { scheduleModule } from "./modules/schedules";
import { aiModule } from "./modules/ai";

const app = new Elysia()
  .use(
    openapi({
      documentation: {
        info: {
          title: "Time Flow API",
          version: "1.0",
          description:
            "AI-powered Dynamic Time Blocker – schedule management with NLP, conflict detection, burnout prevention, and optimization.",
        },
        tags: [
          { name: "Auth", description: "Registration and sign-in" },
          { name: "User", description: "Profile and settings" },
          { name: "Schedules", description: "Activity CRUD and audit" },
          { name: "AI", description: "NLP prompt, optimize, confirm" },
        ],
      },
    })
  )
  .get("/", () => ({
    name: "Time Flow API",
    version: "1.0",
    docs: "See /openapi for Swagger/Scalar documentation",
  }))
  .use(authPublic)
  .use(userModule)
  .use(scheduleModule)
  .use(aiModule)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
