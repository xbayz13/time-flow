import { t } from "elysia";

export const aiModels = {
  promptBody: t.Object({
    prompt: t.String(),
    date: t.Optional(t.String()), // YYYY-MM-DD for context
  }),
  confirmBody: t.Object({
    draftId: t.Optional(t.String()),
    activities: t.Array(
      t.Object({
        title: t.String(),
        // Accept both formats: AI returns start/end, API expects startTime/endTime
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
        start: t.Optional(t.String()),
        end: t.Optional(t.String()),
        isFixed: t.Optional(t.Boolean()),
        category: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        aiReasoning: t.Optional(t.String()),
      })
    ),
  }),
};
