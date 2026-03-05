import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { successObj } from "./utils/response";
import { openapi } from "@elysiajs/openapi";
import { authPublic, authGuard } from "./modules/auth";
import { userModule } from "./modules/user";
import { scheduleModule } from "./modules/schedules";
import { aiModule } from "./modules/ai";

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Referrer-Policy": "no-referrer",
});

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
    () =>
      successObj({
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
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET ?? "dev-secret-min-32-characters-long", exp: "7d" }))
  .use(authPublic)
  .derive(authGuard.derive)
  .onBeforeHandle(authGuard.onBeforeHandle)
  .use(userModule)
  .use(scheduleModule)
  .use(aiModule);

// CORS: Bun.serve manual karena app.compile() di listen() overwrite app.fetch
app.compile();
const elysiaFetch = app.fetch;

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  fetch: async (request: Request) => {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const response = await elysiaFetch.call(app, request);
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  },
});

app.server = server;

console.log(`🦊 Elysia is running at ${server.hostname}:${server.port}`);
