import { isBefore, isAfter, addMinutes, subMinutes } from "date-fns";

export interface ActivitySlot {
  title: string;
  startTime: Date;
  endTime: Date;
  isFixed: boolean;
}

export interface ConflictResult {
  hasConflict: boolean;
  hasFixedConflict: boolean;
  conflicts: ActivitySlot[];
  action: "FIND_ALTERNATIVES" | "RESHUFFLE_FLEXIBLE";
}

export class ConflictManager {
  static check(
    newSlot: ActivitySlot,
    existing: ActivitySlot[],
    bufferMinutes: number
  ): ConflictResult {
    const conflicts = existing.filter((ext) => {
      const protectedEnd = addMinutes(ext.endTime, bufferMinutes);
      const protectedStart = subMinutes(ext.startTime, bufferMinutes);

      return (
        isBefore(newSlot.startTime, protectedEnd) &&
        isAfter(newSlot.endTime, protectedStart)
      );
    });

    const hasFixedConflict = conflicts.some((c) => c.isFixed);

    return {
      hasConflict: conflicts.length > 0,
      hasFixedConflict,
      conflicts,
      action: hasFixedConflict ? "FIND_ALTERNATIVES" : "RESHUFFLE_FLEXIBLE",
    };
  }
}
