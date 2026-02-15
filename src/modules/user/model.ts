import { t } from "elysia";

export const userModels = {
  settingsBody: t.Object({
    bufferMinutes: t.Optional(t.Number({ minimum: 5, maximum: 45 })),
    timezone: t.Optional(t.String()),
    sleepStart: t.Optional(t.String({ pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" })),
  }),
};
