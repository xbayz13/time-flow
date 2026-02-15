import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { authPublic } from "./modules/auth";
import { userModule } from "./modules/user";
import { scheduleModule } from "./modules/schedules";
import { aiModule } from "./modules/ai";

const app = new Elysia()
  .use(
    openapi({
      path: "/docs",
      specPath: "/docs/json",
      documentation: {
        info: {
          title: "Time Flow API",
          version: "1.0",
          description:
            "AI-powered Dynamic Time Blocker – schedule management with NLP, conflict detection, burnout prevention, and optimization.",
        },
        tags: [
          { name: "General", description: "API info and health" },
          { name: "Auth", description: "Registration and sign-in" },
          { name: "User", description: "Profile and settings" },
          { name: "Schedules", description: "Activity CRUD and audit" },
          { name: "AI", description: "NLP prompt, optimize, confirm" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "Use the token from /auth/register or /auth/sign-in",
            },
          },
        },
      },
    })
  )
  .get(
    "/",
    () => ({
      name: "Time Flow API",
      version: "1.0",
      docs: "See /docs for OpenAPI/Scalar documentation",
    }),
    {
      detail: {
        summary: "API info",
        description: "Returns basic API information and documentation link",
        tags: ["General"],
      },
    }
  )
  .use(authPublic)
  .use(userModule)
  .use(scheduleModule)
  .use(aiModule)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
