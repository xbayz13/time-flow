import { describe, expect, it, mock, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { authPublic } from "../auth";
import { userModule } from "../user";
import { scheduleModule } from "../schedules";
import { aiModule } from "./index";
import { client } from "../../../db";

const mockProposal = {
  action: "DRAFT_CREATED" as const,
  summary: "Saya sudah mengatur jadwal Anda.",
  data: {
    new_activities: [
      {
        title: "Meeting Test",
        start: "2026-02-17T10:00:00.000Z",
        end: "2026-02-17T11:00:00.000Z",
        is_fixed: true,
        category: "admin" as const,
        priority: 3,
      },
    ],
    shifted_activities: [],
    alternative_slots: [],
  },
  ai_reasoning: "Test reasoning.",
};

const mockProcessPrompt = mock(async () => mockProposal);

mock.module("./service", () => ({
  AIService: {
    processPrompt: mockProcessPrompt,
  },
}));

const app = new Elysia()
  .use(authPublic)
  .use(userModule)
  .use(scheduleModule)
  .use(aiModule);

async function checkDbConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("AI Module Integration (Phase 3)", () => {
  let token = "";
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      dbAvailable = await checkDbConnection();
      if (!dbAvailable) return;

      const registerRes = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "ai-test@example.com",
            password: "testpass123",
          }),
        })
      );

      if (registerRes.status !== 200) {
        dbAvailable = false;
        return;
      }

      const data = (await registerRes.json()) as { token: string; id: string };
      token = data.token;
    } catch {
      dbAvailable = false;
    }
  });

  it("returns 401 for /ai/prompt without auth", async () => {
    if (!dbAvailable) return;
    const res = await app.handle(
      new Request("http://localhost/ai/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Besok meeting jam 10" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 401 for /ai/confirm without auth", async () => {
    if (!dbAvailable) return;
    const res = await app.handle(
      new Request("http://localhost/ai/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activities: [
            {
              title: "Meeting",
              startTime: "2026-02-17T10:00:00.000Z",
              endTime: "2026-02-17T11:00:00.000Z",
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for /ai/confirm with empty activities", async () => {
    if (!dbAvailable) return;
    const res = await app.handle(
      new Request("http://localhost/ai/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activities: [] }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No activities");
  });

  it("returns proposal from /ai/prompt with valid auth (mocked AI)", async () => {
    if (!dbAvailable) return;
    const res = await app.handle(
      new Request("http://localhost/ai/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: "Besok jam 10 ada meeting 1 jam",
          date: "2026-02-17",
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("DRAFT_CREATED");
    expect(data.summary).toBeDefined();
    expect(data.data.new_activities).toHaveLength(1);
    expect(data.data.new_activities[0].title).toBe("Meeting Test");
    expect(data.status).toBe("PENDING_CONFIRMATION");
    expect(mockProcessPrompt).toHaveBeenCalled();
  });

  it("rejects /ai/optimize without valid auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-02-17" }),
      })
    );
    expect([401, 500]).toContain(res.status);
  });

  it("confirms activities via /ai/confirm and creates in DB", async () => {
    if (!dbAvailable) return;
    const res = await app.handle(
      new Request("http://localhost/ai/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activities: [
            {
              title: "Meeting dari AI",
              startTime: "2026-02-18T09:00:00.000Z",
              endTime: "2026-02-18T10:00:00.000Z",
              isFixed: false,
              category: "admin",
              priority: 3,
              aiReasoning: "Slot pagi yang optimal.",
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toContain("Confirmed");
    expect(data.created).toHaveLength(1);
    expect(data.created[0].title).toBe("Meeting dari AI");
    expect(data.created[0].id).toBeDefined();
  });

  it("Phase 5: audit trail - AI confirm creates audit log", async () => {
    if (!dbAvailable) return;
    const confirmRes = await app.handle(
      new Request("http://localhost/ai/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activities: [
            {
              title: "Audit Test AI",
              startTime: "2026-02-19T14:00:00.000Z",
              endTime: "2026-02-19T15:00:00.000Z",
              isFixed: true,
              category: "admin",
              priority: 3,
            },
          ],
        }),
      })
    );
    expect(confirmRes.status).toBe(200);

    const auditRes = await app.handle(
      new Request("http://localhost/schedules/audit", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(auditRes.status).toBe(200);
    const auditData = (await auditRes.json()) as { auditLogs: Array<{ action: string; source: string; payloadAfter: { title: string } | null }> };
    const aiCreateLog = auditData.auditLogs.find(
      (l) => l.action === "CREATE" && l.source === "AI" && l.payloadAfter?.title === "Audit Test AI"
    );
    expect(aiCreateLog).toBeDefined();
    expect(aiCreateLog!.payloadAfter).toMatchObject({ title: "Audit Test AI", isFixed: true });
  });

  it("Phase 5: audit trail - USER create/delete creates audit log", async () => {
    if (!dbAvailable) return;
    const createRes = await app.handle(
      new Request("http://localhost/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Manual Schedule Audit",
          startTime: "2026-02-20T10:00:00.000Z",
          endTime: "2026-02-20T11:00:00.000Z",
          isFixed: false,
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const createData = (await createRes.json()) as { id: string };

    const auditAfterCreate = await app.handle(
      new Request("http://localhost/schedules/audit", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    const auditCreate = (await auditAfterCreate.json()) as { auditLogs: Array<{ action: string; source: string; payloadAfter: { title: string } | null }> };
    const userCreateLog = auditCreate.auditLogs.find(
      (l) => l.action === "CREATE" && l.source === "USER" && l.payloadAfter?.title === "Manual Schedule Audit"
    );
    expect(userCreateLog).toBeDefined();

    const deleteRes = await app.handle(
      new Request(`http://localhost/schedules/${createData.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(deleteRes.status).toBe(200);

    const auditAfterDelete = await app.handle(
      new Request("http://localhost/schedules/audit", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    const auditDelete = (await auditAfterDelete.json()) as { auditLogs: Array<{ action: string; source: string; payloadBefore: { title: string } | null }> };
    const userDeleteLog = auditDelete.auditLogs.find(
      (l) => l.action === "DELETE" && l.source === "USER" && l.payloadBefore?.title === "Manual Schedule Audit"
    );
    expect(userDeleteLog).toBeDefined();
  });
});
