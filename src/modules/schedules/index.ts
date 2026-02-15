import { Elysia, t } from "elysia";
import { ScheduleService } from "./service";
import { scheduleModels } from "./model";
import { authPlugin } from "../auth";

export const scheduleModule = new Elysia({ prefix: "/schedules" })
  .use(authPlugin)
  .model(scheduleModels)
  .get(
    "/",
    async ({ user, query }) => {
      const date = query.date ?? new Date().toISOString().slice(0, 10);
      const items = await ScheduleService.getByDate(user.id, date);

      return items.map((a) => ({
        id: a.id,
        title: a.title,
        isFixed: a.isFixed,
        startTime: a.startTime,
        endTime: a.endTime,
        priority: a.priority,
        category: a.category,
        status: a.status,
        aiReasoning: a.aiReasoning,
      }));
    },
    {
      query: t.Object({
        date: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      const startTime = new Date(body.startTime);
      const endTime = new Date(body.endTime);

      if (startTime >= endTime) {
        set.status = 400;
        return { error: "startTime must be before endTime" };
      }

      const dateStr = startTime.toISOString().slice(0, 10);
      const existing = await ScheduleService.getByDate(user.id, dateStr);
      const conflict = ScheduleService.checkConflict(
        {
          title: body.title,
          startTime,
          endTime,
          isFixed: body.isFixed ?? false,
        },
        existing,
        user.bufferMinutes
      );

      if (conflict.hasConflict) {
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / (60 * 1000)
        );
        const alternativeSlots = ScheduleService.findAlternativeSlots(
          existing,
          durationMinutes,
          user.bufferMinutes,
          dateStr
        );

        set.status = 409;
        return {
          error: "Schedule conflict detected",
          action: conflict.action,
          conflicts: conflict.conflicts.map((c) => ({
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            isFixed: c.isFixed,
          })),
          alternativeSlots,
        };
      }

      const created = await ScheduleService.create({
        userId: user.id,
        title: body.title,
        isFixed: body.isFixed ?? false,
        startTime,
        endTime,
        priority: body.priority ?? 3,
        category: body.category ?? "admin",
      });

      return {
        id: created.id,
        title: created.title,
        isFixed: created.isFixed,
        startTime: created.startTime,
        endTime: created.endTime,
        priority: created.priority,
        category: created.category,
      };
    },
    {
      body: "createBody",
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      const existing = await ScheduleService.getById(params.id, user.id);
      if (!existing) {
        set.status = 404;
        return { error: "Schedule not found" };
      }

      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.isFixed !== undefined) updates.isFixed = body.isFixed;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.category !== undefined) updates.category = body.category;

      let startTime = new Date(existing.startTime);
      let endTime = new Date(existing.endTime);
      if (body.startTime) startTime = new Date(body.startTime);
      if (body.endTime) endTime = new Date(body.endTime);

      if (startTime >= endTime) {
        set.status = 400;
        return { error: "startTime must be before endTime" };
      }

      updates.startTime = startTime;
      updates.endTime = endTime;

      const dateStr = startTime.toISOString().slice(0, 10);
      const allExisting = await ScheduleService.getByDate(user.id, dateStr);
      const conflict = ScheduleService.checkConflict(
        {
          title: (updates.title as string) ?? existing.title,
          startTime,
          endTime,
          isFixed: (updates.isFixed as boolean) ?? existing.isFixed,
        },
        allExisting,
        user.bufferMinutes,
        params.id
      );

      if (conflict.hasConflict) {
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / (60 * 1000)
        );
        const alternativeSlots = ScheduleService.findAlternativeSlots(
          allExisting,
          durationMinutes,
          user.bufferMinutes,
          dateStr
        );

        set.status = 409;
        return {
          error: "Schedule conflict detected",
          action: conflict.action,
          conflicts: conflict.conflicts.map((c) => ({
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            isFixed: c.isFixed,
          })),
          alternativeSlots,
        };
      }

      const updated = await ScheduleService.update(
        params.id,
        user.id,
        updates as Parameters<typeof ScheduleService.update>[2]
      );

      return {
        id: updated!.id,
        title: updated!.title,
        isFixed: updated!.isFixed,
        startTime: updated!.startTime,
        endTime: updated!.endTime,
        priority: updated!.priority,
        category: updated!.category,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: "updateBody",
    }
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      const deleted = await ScheduleService.delete(params.id, user.id);
      if (!deleted) {
        set.status = 404;
        return { error: "Schedule not found" };
      }
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
