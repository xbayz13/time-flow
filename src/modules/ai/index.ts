import { Elysia, t } from "elysia";
import { errorObj, successObj } from "../../utils/response";
import { getDateInTimezone, parseInputAsUserTz, toUserTzISO } from "../../utils/timezone";
import { checkAIAccess } from "../../utils/aiAccess";
import { AIService } from "./service";
import { aiModels } from "./model";
import { ScheduleService } from "../schedules/service";
import { ConflictManager } from "../../utils/ConflictManager";
import { AuditService } from "../../utils/AuditService";
import { checkAIRateLimit } from "../../utils/RateLimiter";
import type { AuthUser } from "../auth";

type AuthContext = { user: AuthUser };

export const aiModule = new Elysia({
  prefix: "/ai",
  detail: {
    tags: ["AI"],
    security: [{ bearerAuth: [] }],
  },
})
  .model(aiModels)
  .post(
    "/prompt",
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & AuthContext;
      if (!user) {
        set.status = 401;
        return errorObj("Unauthorized", undefined, undefined, "UNAUTHORIZED");
      }
      const access = checkAIAccess(user);
      if (!access.ok) {
        set.status = 403;
        return errorObj(
          "Akses AI ditolak",
          access.message,
          access.reason === "EXPIRED" ? { expiresAt: access.expiresAt } : undefined,
          "AI_ACCESS_DENIED"
        );
      }
      const limit = checkAIRateLimit(user.id, 10, 60_000);
      if (!limit.ok) {
        set.status = 429;
        return errorObj(
          "Limit AI tercapai",
          "Maksimal 10 permintaan AI per menit. Coba lagi nanti.",
          { retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
          "RATE_LIMITED"
        );
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return errorObj("OpenAI API key belum dikonfigurasi", undefined, undefined, "SERVER_ERROR");
      }

      const tz = user.timezone ?? "Asia/Jakarta";
      const dateStr =
        body.date ?? getDateInTimezone(new Date(), tz);
      const existing = await ScheduleService.getByDate(user.id, dateStr, tz);

      const existingContext = existing.map((a) => ({
        title: a.title,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        isFixed: a.isFixed,
        priority: a.priority,
        category: a.category,
      }));

      const analysis = ScheduleService.analyzeSchedule(
        existing,
        user.bufferMinutes,
        dateStr,
        tz
      );
      const analysisContext = {
        burnoutWarnings: analysis.burnoutWarnings,
        triageOverload: analysis.triage.isOverload,
        triageSuggestion: analysis.triage.suggestion ?? undefined,
      };

      try {
        const proposal = await AIService.processPrompt(body.prompt, {
          currentTime: new Date().toISOString(),
          bufferMinutes: user.bufferMinutes,
          sleepStart: user.sleepStart,
          existingSchedules: existingContext,
          analysisContext,
          userTimezone: tz,
        });

        // Validate AI output with ConflictManager (double-check)
        const existingSlots = existing.map((a) => ({
          title: a.title,
          startTime: new Date(a.startTime),
          endTime: new Date(a.endTime),
          isFixed: a.isFixed,
        }));

        for (const act of proposal.data.new_activities) {
          const startTime = new Date(act.start);
          const endTime = new Date(act.end);
          const validation = ConflictManager.check(
            {
              title: act.title,
              startTime,
              endTime,
              isFixed: act.is_fixed,
            },
            existingSlots,
            user.bufferMinutes
          );

          if (validation.hasFixedConflict) {
            const slots = ScheduleService.findAlternativeSlots(
              existing,
              Math.round((endTime.getTime() - startTime.getTime()) / 60000),
              user.bufferMinutes,
              dateStr,
              tz
            );
            set.status = 400;
            return errorObj(
              "Slot bentrok dengan jadwal tetap",
              "AI menyarankan waktu yang bertabrakan dengan jadwal tetap",
              {
                action: "FIND_ALTERNATIVES",
                alternativeSlots: slots.map((s) => ({
                  start: toUserTzISO(new Date(s.start), tz),
                  end: toUserTzISO(new Date(s.end), tz),
                  durationMinutes: s.durationMinutes,
                })),
              },
              "VALIDATION_ERROR"
            );
          }
        }

        const enrichedProposal = {
          ...proposal,
          data: {
            ...proposal.data,
            new_activities: proposal.data.new_activities.map((a) => ({
              ...a,
              start: toUserTzISO(new Date(a.start), tz),
              end: toUserTzISO(new Date(a.end), tz),
            })),
          },
          status: "PENDING_CONFIRMATION",
        };

        return successObj(
          enrichedProposal,
          "Jadwal berhasil digenerate"
        );
      } catch (err) {
        set.status = 500;
        return errorObj("AI gagal memproses", (err as Error).message, undefined, "SERVER_ERROR");
      }
    },
    {
      body: "promptBody",
      detail: {
        summary: "AI prompt",
        description:
          "Send natural language prompt to create/arrange schedules. Rate limit: 10 req/min.",
      },
    }
  )
  .post(
    "/confirm",
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & AuthContext;
      if (!user) {
        set.status = 401;
        return errorObj("Unauthorized", undefined, undefined, "UNAUTHORIZED");
      }
      const access = checkAIAccess(user);
      if (!access.ok) {
        set.status = 403;
        return errorObj(
          "Akses AI ditolak",
          access.message,
          access.reason === "EXPIRED" ? { expiresAt: access.expiresAt } : undefined,
          "AI_ACCESS_DENIED"
        );
      }
      if (!body.activities?.length) {
        set.status = 400;
        return errorObj("Tidak ada aktivitas untuk dikonfirmasi", undefined, undefined, "BAD_REQUEST");
      }

      const created: Array<{
        id: string;
        title: string;
        startTime: string;
        endTime: string;
        category: string;
      }> = [];

      const tz = user.timezone ?? "Asia/Jakarta";

      for (const act of body.activities) {
        const startTimeStr = act.startTime ?? act.start;
        const endTimeStr = act.endTime ?? act.end;
        if (!startTimeStr || !endTimeStr) {
          set.status = 400;
          return errorObj("Setiap aktivitas harus memiliki startTime dan endTime", undefined, undefined, "VALIDATION_ERROR");
        }
        const startTime = parseInputAsUserTz(startTimeStr, tz);
        const endTime = parseInputAsUserTz(endTimeStr, tz);
        const dateStr = getDateInTimezone(startTime, tz);
        const existing = await ScheduleService.getByDate(user.id, dateStr, tz);
        const conflict = ScheduleService.checkConflict(
          {
            title: act.title,
            startTime,
            endTime,
            isFixed: act.isFixed ?? false,
          },
          existing,
          user.bufferMinutes
        );

        if (conflict.hasConflict) {
          set.status = 409;
          return errorObj("Tidak bisa mengonfirmasi: konflik jadwal terdeteksi", undefined, {
            conflicts: conflict.conflicts.map((c) => ({
              title: c.title,
              startTime: toUserTzISO(c.startTime, tz),
              endTime: toUserTzISO(c.endTime, tz),
              isFixed: c.isFixed,
            })),
          }, "CONFLICT");
        }

        const c = await ScheduleService.create({
          userId: user.id,
          title: act.title,
          isFixed: act.isFixed ?? false,
          startTime,
          endTime,
          priority: act.priority ?? 3,
          category: (act.category as "deep_work" | "admin" | "health" | "social") ?? "admin",
          status: "PLANNED",
          aiReasoning: act.aiReasoning ?? null,
        });

        await AuditService.logCreate(user.id, c.id, "AI", {
          title: c.title,
          isFixed: c.isFixed,
          startTime: c.startTime.toISOString(),
          endTime: c.endTime.toISOString(),
          priority: c.priority,
          category: c.category,
          aiReasoning: c.aiReasoning,
        });

        created.push({
          id: c.id,
          title: c.title,
          startTime: toUserTzISO(c.startTime, tz),
          endTime: toUserTzISO(c.endTime, tz),
          category: c.category,
        });
      }

      return successObj(
        {
          summary: `Confirmed ${created.length} activity/activities`,
          created,
        },
        `${created.length} jadwal berhasil disimpan`
      );
    },
    {
      body: "confirmBody",
      detail: {
        summary: "Confirm AI proposal",
        description:
          "Confirm and persist AI-generated activities. Use after /ai/prompt returns PENDING_CONFIRMATION.",
      },
    }
  )
  .post(
    "/optimize",
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & AuthContext;
      if (!user) {
        set.status = 401;
        return errorObj("Unauthorized", undefined, undefined, "UNAUTHORIZED");
      }
      const access = checkAIAccess(user);
      if (!access.ok) {
        set.status = 403;
        return errorObj(
          "Akses AI ditolak",
          access.message,
          access.reason === "EXPIRED" ? { expiresAt: access.expiresAt } : undefined,
          "AI_ACCESS_DENIED"
        );
      }
      const limit = checkAIRateLimit(user.id, 10, 60_000);
      if (!limit.ok) {
        set.status = 429;
        return errorObj(
          "Limit AI tercapai",
          "Maksimal 10 permintaan AI per menit. Coba lagi nanti.",
          { retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
          "RATE_LIMITED"
        );
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return errorObj("OpenAI API key belum dikonfigurasi", undefined, undefined, "SERVER_ERROR");
      }

      const tz = user.timezone ?? "Asia/Jakarta";
      const dateStr =
        body?.date ?? getDateInTimezone(new Date(), tz);
      const existing = await ScheduleService.getByDate(user.id, dateStr, tz);

      const existingContext = existing.map((a) => ({
        title: a.title,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        isFixed: a.isFixed,
        priority: a.priority,
        category: a.category,
      }));

      const analysis = ScheduleService.analyzeSchedule(
        existing,
        user.bufferMinutes,
        dateStr,
        tz
      );
      const analysisContext = {
        burnoutWarnings: analysis.burnoutWarnings,
        triageOverload: analysis.triage.isOverload,
        triageSuggestion: analysis.triage.suggestion ?? undefined,
      };

      const prompt = `Optimize my schedule for ${dateStr}. ONLY rearrange activities with is_fixed: false. Protect fixed activities. Current: ${JSON.stringify(existingContext)}. Insert Rest Blocks if burnout detected.`;

      try {
        const proposal = await AIService.processPrompt(prompt, {
          currentTime: new Date().toISOString(),
          bufferMinutes: user.bufferMinutes,
          sleepStart: user.sleepStart,
          existingSchedules: existingContext,
          analysisContext,
          userTimezone: tz,
        });

        const enrichedProposal = {
          ...proposal,
          data: {
            ...proposal.data,
            new_activities: (proposal.data.new_activities ?? []).map((a) => ({
              ...a,
              start: toUserTzISO(new Date(a.start), tz),
              end: toUserTzISO(new Date(a.end), tz),
            })),
            shifted_activities: (proposal.data.shifted_activities ?? []).map((a) => ({
              ...a,
              start: toUserTzISO(new Date(a.start), tz),
              end: toUserTzISO(new Date(a.end), tz),
            })),
          },
          status: "PENDING_CONFIRMATION",
        };

        return successObj(
          enrichedProposal,
          "Jadwal berhasil dioptimasi"
        );
      } catch (err) {
        set.status = 500;
        return errorObj("Optimasi AI gagal", (err as Error).message, undefined, "SERVER_ERROR");
      }
    },
    {
      body: t.Object({ date: t.Optional(t.String()) }),
      detail: {
        summary: "Optimize schedule",
        description:
          "AI optimizes schedule for the given date. Rearranges non-fixed activities, adds rest blocks if needed. Rate limit: 10 req/min.",
      },
    }
  );
