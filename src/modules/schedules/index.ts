import { Elysia, t } from "elysia";
import { ScheduleService } from "./service";
import { scheduleModels } from "./model";
import { AuditService } from "../../utils/AuditService";
import { getDateInTimezone, parseInputAsUserTz, toUserTzISO } from "../../utils/timezone";
import { errorObj, successObj } from "../../utils/response";

export const scheduleModule = new Elysia({
  prefix: "/schedules",
  detail: {
    tags: ["Schedules"],
    security: [{ bearerAuth: [] }],
  },
})
  .model(scheduleModels)
  .get(
    "/",
    async ({ user, query }) => {
      const tz = user.timezone ?? "Asia/Jakarta";
      const date =
        query.date ??
        getDateInTimezone(new Date(), tz);
      const items = await ScheduleService.getByDate(user.id, date, tz);

      const result = items.map((a) => ({
        id: a.id,
        title: a.title,
        isFixed: a.isFixed,
        startTime: toUserTzISO(a.startTime, tz),
        endTime: toUserTzISO(a.endTime, tz),
        priority: a.priority,
        category: a.category,
        status: a.status,
        aiReasoning: a.aiReasoning,
      }));

      if (query.analyze === "true") {
        const analysis = ScheduleService.analyzeSchedule(
          items,
          user.bufferMinutes,
          date,
          tz
        );
        return successObj({
          schedules: result,
          burnoutWarnings: analysis.burnoutWarnings,
          triage: analysis.triage,
        });
      }

      return successObj({ schedules: result });
    },
    {
      query: t.Object({
        date: t.Optional(t.String()),
        analyze: t.Optional(t.String()),
      }),
      detail: {
        summary: "List schedules",
        description:
          "Get schedules for a date. Always returns { schedules: [...] }. Use ?analyze=true for burnout warnings and triage.",
      },
    }
  )
  .get(
    "/audit",
    async ({ user, query }) => {
      const limit = Math.min(Number(query.limit) || 50, 100);
      const logs = await AuditService.getByUser(user.id, limit);
      return successObj({ auditLogs: logs, meta: { limit, count: logs.length } });
    },
    {
      query: t.Object({ limit: t.Optional(t.String()) }),
      detail: {
        summary: "Audit log",
        description: "Get audit trail of schedule changes. Use ?limit=N (max 100).",
      },
    }
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      const tz = user.timezone ?? "Asia/Jakarta";
      const startTime = parseInputAsUserTz(body.startTime, tz);
      const endTime = parseInputAsUserTz(body.endTime, tz);

      if (startTime >= endTime) {
        set.status = 400;
        return errorObj("Waktu mulai harus sebelum waktu selesai", undefined, undefined, "VALIDATION_ERROR");
      }

      const dateStr = getDateInTimezone(startTime, tz);
      const existing = await ScheduleService.getByDate(user.id, dateStr, tz);
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
          dateStr,
          tz
        );

        set.status = 409;
        return errorObj("Konflik jadwal terdeteksi", "Jadwal bertabrakan dengan aktivitas lain", {
          action: conflict.action,
          conflicts: conflict.conflicts.map((c) => ({
            title: c.title,
            startTime: toUserTzISO(c.startTime, tz),
            endTime: toUserTzISO(c.endTime, tz),
            isFixed: c.isFixed,
          })),
          alternativeSlots: alternativeSlots.map((s) => ({
            start: toUserTzISO(new Date(s.start), tz),
            end: toUserTzISO(new Date(s.end), tz),
            durationMinutes: s.durationMinutes,
          })),
        }, "CONFLICT");
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

      await AuditService.logCreate(user.id, created.id, "USER", {
        title: created.title,
        isFixed: created.isFixed,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime.toISOString(),
        priority: created.priority,
        category: created.category,
      });

      return successObj(
        {
          id: created.id,
          title: created.title,
          isFixed: created.isFixed,
          startTime: toUserTzISO(created.startTime, tz),
          endTime: toUserTzISO(created.endTime, tz),
          priority: created.priority,
          category: created.category,
        },
        "Jadwal berhasil ditambahkan"
      );
    },
    {
      body: "createBody",
      detail: {
        summary: "Create schedule",
        description:
          "Create a new schedule. Returns 409 with alternative slots if conflict detected.",
      },
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      const existing = await ScheduleService.getById(params.id, user.id);
      if (!existing) {
        set.status = 404;
        return errorObj("Jadwal tidak ditemukan", undefined, undefined, "NOT_FOUND");
      }

      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.isFixed !== undefined) updates.isFixed = body.isFixed;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.category !== undefined) updates.category = body.category;

      const tz = user.timezone ?? "Asia/Jakarta";
      let startTime = new Date(existing.startTime);
      let endTime = new Date(existing.endTime);
      if (body.startTime) startTime = parseInputAsUserTz(body.startTime, tz);
      if (body.endTime) endTime = parseInputAsUserTz(body.endTime, tz);

      if (startTime >= endTime) {
        set.status = 400;
        return errorObj("Waktu mulai harus sebelum waktu selesai", undefined, undefined, "VALIDATION_ERROR");
      }

      updates.startTime = startTime;
      updates.endTime = endTime;

      const dateStr = getDateInTimezone(startTime, tz);
      const allExisting = await ScheduleService.getByDate(user.id, dateStr, tz);
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
          dateStr,
          tz
        );

        set.status = 409;
        return errorObj("Konflik jadwal terdeteksi", "Jadwal bertabrakan dengan aktivitas lain", {
          action: conflict.action,
          conflicts: conflict.conflicts.map((c) => ({
            title: c.title,
            startTime: toUserTzISO(c.startTime, tz),
            endTime: toUserTzISO(c.endTime, tz),
            isFixed: c.isFixed,
          })),
          alternativeSlots: alternativeSlots.map((s) => ({
            start: toUserTzISO(new Date(s.start), tz),
            end: toUserTzISO(new Date(s.end), tz),
            durationMinutes: s.durationMinutes,
          })),
        }, "CONFLICT");
      }

      const updated = await ScheduleService.update(
        params.id,
        user.id,
        updates as Parameters<typeof ScheduleService.update>[2]
      );

      await AuditService.logUpdate(
        user.id,
        params.id,
        "USER",
        {
          title: existing.title,
          isFixed: existing.isFixed,
          startTime: existing.startTime.toISOString(),
          endTime: existing.endTime.toISOString(),
          priority: existing.priority,
          category: existing.category,
        },
        {
          title: updated!.title,
          isFixed: updated!.isFixed,
          startTime: updated!.startTime.toISOString(),
          endTime: updated!.endTime.toISOString(),
          priority: updated!.priority,
          category: updated!.category,
        }
      );

      return successObj(
        {
          id: updated!.id,
          title: updated!.title,
          isFixed: updated!.isFixed,
          startTime: toUserTzISO(updated!.startTime, tz),
          endTime: toUserTzISO(updated!.endTime, tz),
          priority: updated!.priority,
          category: updated!.category,
        },
        "Jadwal berhasil diperbarui"
      );
    },
    {
      params: t.Object({ id: t.String() }),
      body: "updateBody",
      detail: {
        summary: "Update schedule",
        description:
          "Update a schedule by ID. Returns 409 if conflict detected.",
      },
    }
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      const existing = await ScheduleService.getById(params.id, user.id);
      if (!existing) {
        set.status = 404;
        return errorObj("Jadwal tidak ditemukan", undefined, undefined, "NOT_FOUND");
      }
      const deleted = await ScheduleService.delete(params.id, user.id);
      if (!deleted) {
        set.status = 404;
        return errorObj("Jadwal tidak ditemukan", undefined, undefined, "NOT_FOUND");
      }
      await AuditService.logDelete(user.id, params.id, "USER", {
        title: existing.title,
        isFixed: existing.isFixed,
        startTime: existing.startTime.toISOString(),
        endTime: existing.endTime.toISOString(),
        priority: existing.priority,
        category: existing.category,
      });
      return successObj({}, "Jadwal berhasil dihapus");
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Delete schedule",
        description: "Delete a schedule by ID.",
      },
    }
  );
