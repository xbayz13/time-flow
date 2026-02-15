import { describe, expect, it } from "bun:test";
import { BurnoutDetector } from "./BurnoutDetector";

describe("BurnoutDetector", () => {
  it("returns no warnings when work sessions are under 3 hours", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T10:30:00.000Z"),
        category: "deep_work",
      },
      {
        startTime: new Date("2026-02-16T11:00:00.000Z"),
        endTime: new Date("2026-02-16T12:00:00.000Z"),
        category: "admin",
      },
    ];
    const warnings = BurnoutDetector.detect(activities, 15);
    expect(warnings).toHaveLength(0);
  });

  it("detects >3 hours continuous work", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T12:30:00.000Z"),
        category: "deep_work",
      },
    ];
    const warnings = BurnoutDetector.detect(activities, 15);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].continuousMinutes).toBe(210);
    expect(warnings[0].suggestion).toContain("Short Break");
  });

  it("health/social activity resets work streak", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T11:00:00.000Z"),
        category: "deep_work",
      },
      {
        startTime: new Date("2026-02-16T11:15:00.000Z"),
        endTime: new Date("2026-02-16T11:30:00.000Z"),
        category: "health",
      },
      {
        startTime: new Date("2026-02-16T11:45:00.000Z"),
        endTime: new Date("2026-02-16T12:30:00.000Z"),
        category: "admin",
      },
    ];
    const warnings = BurnoutDetector.detect(activities, 15);
    expect(warnings).toHaveLength(0);
  });

  it("detects back-to-back work exceeding 3 hours", () => {
    const activities = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T10:30:00.000Z"),
        category: "deep_work",
      },
      {
        startTime: new Date("2026-02-16T10:45:00.000Z"),
        endTime: new Date("2026-02-16T12:45:00.000Z"),
        category: "admin",
      },
    ];
    const warnings = BurnoutDetector.detect(activities, 15);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});
