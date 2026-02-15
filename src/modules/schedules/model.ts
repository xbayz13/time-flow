import { t } from "elysia";

export const scheduleModels = {
  createBody: t.Object({
    title: t.String(),
    isFixed: t.Optional(t.Boolean()),
    startTime: t.String(),
    endTime: t.String(),
    priority: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
    category: t.Optional(
      t.Union([
        t.Literal("deep_work"),
        t.Literal("admin"),
        t.Literal("health"),
        t.Literal("social"),
      ])
    ),
  }),
  updateBody: t.Object({
    title: t.Optional(t.String()),
    isFixed: t.Optional(t.Boolean()),
    startTime: t.Optional(t.String()),
    endTime: t.Optional(t.String()),
    priority: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
    category: t.Optional(
      t.Union([
        t.Literal("deep_work"),
        t.Literal("admin"),
        t.Literal("health"),
        t.Literal("social"),
      ])
    ),
  }),
};
