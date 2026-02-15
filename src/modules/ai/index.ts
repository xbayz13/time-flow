import { Elysia, t } from "elysia";
import { authPlugin } from "../auth";
import { AIService } from "./service";
import { aiModels } from "./model";
import { ScheduleService } from "../schedules/service";
import { ConflictManager } from "../../utils/ConflictManager";

export const aiModule = new Elysia({ prefix: "/ai" })
  .use(authPlugin)
  .model(aiModels)
  .post(
    "/prompt",
    async ({ user, body, set }) => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return { error: "OpenAI API key not configured" };
      }

      const dateStr =
        body.date ?? new Date().toISOString().slice(0, 10);
      const existing = await ScheduleService.getByDate(user.id, dateStr);

      const existingContext = existing.map((a) => ({
        title: a.title,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        isFixed: a.isFixed,
        priority: a.priority,
        category: a.category,
      }));

      try {
        const proposal = await AIService.processPrompt(body.prompt, {
          currentTime: new Date().toISOString(),
          bufferMinutes: user.bufferMinutes,
          sleepStart: user.sleepStart,
          existingSchedules: existingContext,
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
            set.status = 400;
            return {
              error: "AI suggested a slot that conflicts with fixed schedule",
              action: "FIND_ALTERNATIVES",
              alternativeSlots: ScheduleService.findAlternativeSlots(
                existing,
                Math.round((endTime.getTime() - startTime.getTime()) / 60000),
                user.bufferMinutes,
                dateStr
              ),
            };
          }
        }

        return {
          ...proposal,
          status: "PENDING_CONFIRMATION",
        };
      } catch (err) {
        set.status = 500;
        return {
          error: "AI processing failed",
          message: (err as Error).message,
        };
      }
    },
    { body: "promptBody" }
  )
  .post(
    "/confirm",
    async ({ user, body, set }) => {
      if (!body.activities?.length) {
        set.status = 400;
        return { error: "No activities to confirm" };
      }

      const created: Array<{
        id: string;
        title: string;
        startTime: Date;
        endTime: Date;
        category: string;
      }> = [];

      for (const act of body.activities) {
        const startTime = new Date(act.startTime);
        const endTime = new Date(act.endTime);

        const dateStr = startTime.toISOString().slice(0, 10);
        const existing = await ScheduleService.getByDate(user.id, dateStr);
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
          return {
            error: "Cannot confirm: schedule conflict detected",
            conflicts: conflict.conflicts,
          };
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

        created.push({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          category: c.category,
        });
      }

      return {
        summary: `Confirmed ${created.length} activity/activities`,
        created,
      };
    },
    { body: "confirmBody" }
  )
  .post(
    "/optimize",
    async ({ user, body, set }) => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return { error: "OpenAI API key not configured" };
      }

      const dateStr =
        body?.date ?? new Date().toISOString().slice(0, 10);
      const existing = await ScheduleService.getByDate(user.id, dateStr);

      const existingContext = existing.map((a) => ({
        title: a.title,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        isFixed: a.isFixed,
        priority: a.priority,
        category: a.category,
      }));

      const prompt = `Optimize my schedule for ${dateStr}. Current schedule: ${JSON.stringify(existingContext)}. Rearrange flexible activities for better flow, protect fixed ones, ensure buffers.`;

      try {
        const proposal = await AIService.processPrompt(prompt, {
          currentTime: new Date().toISOString(),
          bufferMinutes: user.bufferMinutes,
          sleepStart: user.sleepStart,
          existingSchedules: existingContext,
        });

        return {
          ...proposal,
          status: "PENDING_CONFIRMATION",
        };
      } catch (err) {
        set.status = 500;
        return {
          error: "AI optimization failed",
          message: (err as Error).message,
        };
      }
    },
    { body: t.Object({ date: t.Optional(t.String()) }) }
  );
