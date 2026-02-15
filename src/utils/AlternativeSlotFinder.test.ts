import { describe, expect, it } from "bun:test";
import { AlternativeSlotFinder } from "./AlternativeSlotFinder";

describe("AlternativeSlotFinder", () => {
  const dayStart = new Date("2026-02-16T00:00:00.000Z");
  const dayEnd = new Date("2026-02-16T23:59:59.999Z");

  it("returns full day when no activities", () => {
    const slots = AlternativeSlotFinder.find(
      [],
      60,
      15,
      dayStart,
      dayEnd
    );
    expect(slots.length).toBe(1);
    expect(slots[0].start).toBe(dayStart.toISOString());
    expect(slots[0].durationMinutes).toBe(60);
  });

  it("finds gap before first activity", () => {
    const existing = [
      {
        startTime: new Date("2026-02-16T10:00:00.000Z"),
        endTime: new Date("2026-02-16T11:00:00.000Z"),
        isFixed: true,
      },
    ];
    const slots = AlternativeSlotFinder.find(
      existing,
      30,
      15,
      dayStart,
      dayEnd
    );
    // Gap: 00:00 to 09:45 (10:00 - 15min buffer)
    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots[0].start).toBe(dayStart.toISOString());
  });

  it("finds gap between two activities", () => {
    const existing = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: true,
      },
      {
        startTime: new Date("2026-02-16T12:00:00.000Z"),
        endTime: new Date("2026-02-16T13:00:00.000Z"),
        isFixed: true,
      },
    ];
    const slots = AlternativeSlotFinder.find(
      existing,
      30, // 30 min needed
      15, // 15 min buffer
      dayStart,
      dayEnd
    );
    // Gap between: 10:15 to 11:45 (1.5 hours)
    const betweenSlots = slots.filter((s) => {
      const start = new Date(s.start);
      return start >= new Date("2026-02-16T10:15:00.000Z") &&
             start <= new Date("2026-02-16T11:30:00.000Z");
    });
    expect(betweenSlots.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when no gap fits required duration", () => {
    const existing = [
      {
        startTime: new Date("2026-02-16T09:00:00.000Z"),
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: true,
      },
      {
        startTime: new Date("2026-02-16T10:20:00.000Z"), // only 5 min gap (10:15-10:20)
        endTime: new Date("2026-02-16T12:00:00.000Z"),
        isFixed: true,
      },
    ];
    const slots = AlternativeSlotFinder.find(
      existing,
      60, // need 60 min, gap is only 5 min
      15,
      dayStart,
      dayEnd
    );
    const betweenSlots = slots.filter((s) => {
      const start = new Date(s.start);
      return start >= new Date("2026-02-16T10:15:00.000Z") &&
             start <= new Date("2026-02-16T10:20:00.000Z");
    });
    expect(betweenSlots.length).toBe(0);
  });
});
