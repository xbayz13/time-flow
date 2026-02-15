import { describe, expect, it } from "bun:test";
import {
  aiResponseSchema,
  buildSystemPrompt,
  type AIProposal,
} from "./service";

describe("AIService", () => {
  describe("aiResponseSchema", () => {
    const validProposal: AIProposal = {
      action: "DRAFT_CREATED",
      summary: "Saya sudah mengatur jadwal Anda.",
      data: {
        new_activities: [
          {
            title: "Meeting",
            start: "2026-02-17T10:00:00.000Z",
            end: "2026-02-17T11:00:00.000Z",
            is_fixed: true,
            category: "admin",
            priority: 3,
          },
        ],
        shifted_activities: [],
        alternative_slots: [],
      },
      ai_reasoning: "Menempatkan meeting di slot yang tersedia.",
    };

    it("parses valid AI proposal", () => {
      const result = aiResponseSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("DRAFT_CREATED");
        expect(result.data.data.new_activities).toHaveLength(1);
        expect(result.data.data.new_activities[0].title).toBe("Meeting");
      }
    });

    it("rejects invalid action", () => {
      const invalid = { ...validProposal, action: "INVALID" };
      const result = aiResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid category", () => {
      const invalid = {
        ...validProposal,
        data: {
          ...validProposal.data,
          new_activities: [
            {
              ...validProposal.data.new_activities[0],
              category: "invalid_category",
            },
          ],
        },
      };
      const result = aiResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects priority out of range", () => {
      const invalid = {
        ...validProposal,
        data: {
          ...validProposal.data,
          new_activities: [
            { ...validProposal.data.new_activities[0], priority: 10 },
          ],
        },
      };
      const result = aiResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("buildSystemPrompt", () => {
    it("includes current time in prompt", () => {
      const prompt = buildSystemPrompt(
        "2026-02-17T08:00:00.000Z",
        15,
        "22:00",
        []
      );
      expect(prompt).toContain("2026-02-17T08:00:00.000Z");
    });

    it("includes user buffer in prompt", () => {
      const prompt = buildSystemPrompt(
        "2026-02-17T08:00:00.000Z",
        20,
        "22:00",
        []
      );
      expect(prompt).toContain("20");
    });

    it("includes existing schedules as JSON", () => {
      const schedules = [
        {
          title: "Meeting",
          startTime: "2026-02-17T10:00:00.000Z",
          endTime: "2026-02-17T11:00:00.000Z",
          isFixed: true,
          priority: 3,
          category: "admin",
        },
      ];
      const prompt = buildSystemPrompt(
        "2026-02-17T08:00:00.000Z",
        15,
        "22:00",
        schedules
      );
      expect(prompt).toContain("Meeting");
      expect(prompt).toContain(JSON.stringify(schedules));
    });

    it("includes Dynamic Buffer Engine identity", () => {
      const prompt = buildSystemPrompt("", 15, "22:00", []);
      expect(prompt).toContain("Dynamic Buffer Engine");
    });

    it("includes operational rules", () => {
      const prompt = buildSystemPrompt("", 15, "22:00", []);
      expect(prompt).toContain("Normalization");
      expect(prompt).toContain("Buffer Policy");
      expect(prompt).toContain("Conflict Resolution");
      expect(prompt).toContain("ai_reasoning");
    });
  });
});
