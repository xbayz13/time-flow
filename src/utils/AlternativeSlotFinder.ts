import { addMinutes, subMinutes, isBefore, isAfter } from "date-fns";

export interface ActivitySlot {
  startTime: Date;
  endTime: Date;
  isFixed: boolean;
}

export interface AlternativeSlot {
  start: string; // ISO-8601
  end: string;
  durationMinutes: number;
}

/**
 * Finds gaps in schedule where a new activity can fit, respecting buffer.
 * Returns slots sorted by start time.
 */
export class AlternativeSlotFinder {
  static find(
    existing: ActivitySlot[],
    requiredDurationMinutes: number,
    bufferMinutes: number,
    dayStart: Date,
    dayEnd: Date
  ): AlternativeSlot[] {
    const slots: AlternativeSlot[] = [];
    const sorted = [...existing].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // No activities: entire day is available
    if (sorted.length === 0) {
      const gapMinutes =
        (dayEnd.getTime() - dayStart.getTime()) / (60 * 1000);
      if (gapMinutes >= requiredDurationMinutes) {
        slots.push({
          start: dayStart.toISOString(),
          end: addMinutes(dayStart, requiredDurationMinutes).toISOString(),
          durationMinutes: requiredDurationMinutes,
        });
      }
      return slots;
    }

    // Gap from day start to first activity
    const first = sorted[0];
    const gapStart = dayStart;
    const gapEnd = subMinutes(new Date(first.startTime), bufferMinutes);

    if (isAfter(gapEnd, gapStart)) {
      const gapMinutes =
        (gapEnd.getTime() - gapStart.getTime()) / (60 * 1000);
      if (gapMinutes >= requiredDurationMinutes) {
        slots.push({
          start: gapStart.toISOString(),
          end: addMinutes(gapStart, requiredDurationMinutes).toISOString(),
          durationMinutes: requiredDurationMinutes,
        });
      }
    }

    // Gaps between activities
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const gapStartTime = addMinutes(new Date(curr.endTime), bufferMinutes);
      const gapEndTime = subMinutes(new Date(next.startTime), bufferMinutes);

      if (!isBefore(gapStartTime, gapEndTime)) continue;

      const gapMinutes =
        (gapEndTime.getTime() - gapStartTime.getTime()) / (60 * 1000);
      if (gapMinutes >= requiredDurationMinutes) {
        slots.push({
          start: gapStartTime.toISOString(),
          end: addMinutes(gapStartTime, requiredDurationMinutes).toISOString(),
          durationMinutes: requiredDurationMinutes,
        });
      }
    }

    // Gap from last activity to day end
    const last = sorted[sorted.length - 1];
    if (last) {
      const gapStartTime = addMinutes(new Date(last.endTime), bufferMinutes);
      const gapEndTime = dayEnd;

      if (isBefore(gapStartTime, gapEndTime)) {
        const gapMinutes =
          (gapEndTime.getTime() - gapStartTime.getTime()) / (60 * 1000);
        if (gapMinutes >= requiredDurationMinutes) {
          slots.push({
            start: gapStartTime.toISOString(),
            end: addMinutes(gapStartTime, requiredDurationMinutes).toISOString(),
            durationMinutes: requiredDurationMinutes,
          });
        }
      }
    }

    return slots;
  }
}
