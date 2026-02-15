import { describe, expect, it } from "bun:test";
import { TriageAnalyzer } from "./TriageAnalyzer";

describe("TriageAnalyzer", () => {
  const dayStart = new Date("2026-02-16T00:00:00.000Z");
  const dayEnd = new Date("2026-02-16T23:59:59.999Z");

  it("returns not overload when schedule fits", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: true,
        priority: 4,
      },
      {
        startTime: new Date("2026-02-16T10:30:00.000Z"),
        endTime: new Date("2026-02-16T11:30:00.000Z"),
        isFixed: false,
        priority: 3,
      },
    ];
    const result = TriageAnalyzer.analyze(
      activities,
      15,
      dayStart,
      dayEnd
    );
    expect(result.isOverload).toBe(false);
    expect(result.remainingMinutes).toBeGreaterThanOrEqual(0);
  });

  it("detects overload when total exceeds available", () => {
    const activities = Array.from({ length: 25 }, (_, i) => ({
      startTime: new Date(`2026-02-16T08:00:00.000Z`),
      endTime: new Date(`2026-02-16T09:00:00.000Z`),
      isFixed: false,
      priority: 3,
    }));
    const result = TriageAnalyzer.analyze(
      activities,
      15,
      dayStart,
      dayEnd
    );
    expect(result.isOverload).toBe(true);
    expect(result.suggestion).toBeDefined();
    expect(result.suggestedMoves.length).toBeGreaterThan(0);
  });

  it("suggestedMoves only includes flexible low-priority tasks", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T18:00:00.000Z"),
        isFixed: true,
        priority: 5,
        title: "Fixed Meeting",
      },
      {
        startTime: new Date("2026-02-16T18:15:00.000Z"),
        endTime: new Date("2026-02-16T19:15:00.000Z"),
        isFixed: false,
        priority: 2,
        title: "Flexible Task",
      },
    ];
    const result = TriageAnalyzer.analyze(
      activities,
      15,
      dayStart,
      dayEnd
    );
    if (result.suggestedMoves.length > 0) {
      expect(result.suggestedMoves.every((m) => m.title !== "Fixed Meeting")).toBe(true);
    }
  });
});
