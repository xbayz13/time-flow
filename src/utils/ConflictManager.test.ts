import { describe, expect, it } from "bun:test";
import { ConflictManager } from "./ConflictManager";

describe("ConflictManager", () => {
  const baseDate = new Date("2026-02-16T09:00:00.000Z");

  it("detects no conflict when slots are separated by buffer", () => {
    const existing = [
      {
        title: "Meeting",
        startTime: baseDate,
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: true,
      },
    ];
    const newSlot = {
      title: "Deep Work",
      startTime: new Date("2026-02-16T10:15:00.000Z"), // 15 min after meeting
      endTime: new Date("2026-02-16T11:15:00.000Z"),
      isFixed: false,
    };

    const result = ConflictManager.check(newSlot, existing, 15);
    expect(result.hasConflict).toBe(false);
  });

  it("detects conflict when new slot overlaps without buffer", () => {
    const existing = [
      {
        title: "Meeting",
        startTime: baseDate,
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: true,
      },
    ];
    const newSlot = {
      title: "Deep Work",
      startTime: new Date("2026-02-16T09:30:00.000Z"), // overlaps
      endTime: new Date("2026-02-16T10:30:00.000Z"),
      isFixed: false,
    };

    const result = ConflictManager.check(newSlot, existing, 15);
    expect(result.hasConflict).toBe(true);
    expect(result.hasFixedConflict).toBe(true);
    expect(result.action).toBe("FIND_ALTERNATIVES");
  });

  it("detects conflict with flexible activity → RESHUFFLE_FLEXIBLE", () => {
    const existing = [
      {
        title: "Flexible Task",
        startTime: baseDate,
        endTime: new Date("2026-02-16T10:00:00.000Z"),
        isFixed: false,
      },
    ];
    const newSlot = {
      title: "New Task",
      startTime: new Date("2026-02-16T09:30:00.000Z"),
      endTime: new Date("2026-02-16T10:30:00.000Z"),
      isFixed: false,
    };

    const result = ConflictManager.check(newSlot, existing, 15);
    expect(result.hasConflict).toBe(true);
    expect(result.hasFixedConflict).toBe(false);
    expect(result.action).toBe("RESHUFFLE_FLEXIBLE");
  });

  it("detects conflict when new slot starts before protected zone", () => {
    const existing = [
      {
        title: "Meeting",
        startTime: new Date("2026-02-16T10:00:00.000Z"),
        endTime: new Date("2026-02-16T11:00:00.000Z"),
        isFixed: true,
      },
    ];
    const newSlot = {
      title: "Prep",
      startTime: new Date("2026-02-16T09:50:00.000Z"), // 10 min before, buffer 15
      endTime: new Date("2026-02-16T10:05:00.000Z"),
      isFixed: false,
    };

    const result = ConflictManager.check(newSlot, existing, 15);
    expect(result.hasConflict).toBe(true);
  });
});
