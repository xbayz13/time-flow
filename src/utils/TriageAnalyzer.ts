import { differenceInMinutes } from "date-fns";

export interface ActivitySlot {
  startTime: Date;
  endTime: Date;
  isFixed: boolean;
  priority: number;
  title?: string;
}

export interface TriageResult {
  isOverload: boolean;
  totalDurationMinutes: number;
  availableMinutes: number;
  remainingMinutes: number;
  suggestion: string | null;
  suggestedMoves: Array<{ title: string; priority: number; suggestedDate: string }>;
}

/**
 * Analyzes if the day is overloaded (total task duration + buffer > available time).
 * Returns triage suggestion for moving low-priority tasks to next day.
 */
export class TriageAnalyzer {
  static analyze(
    activities: ActivitySlot[],
    bufferMinutes: number,
    dayStart: Date,
    dayEnd: Date
  ): TriageResult {
    const availableMinutes = differenceInMinutes(dayEnd, dayStart);

    const sorted = [...activities].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let totalDurationMinutes = 0;
    for (const act of sorted) {
      const duration = differenceInMinutes(
        new Date(act.endTime),
        new Date(act.startTime)
      );
      totalDurationMinutes += duration;
    }
    const bufferTotal =
      sorted.length > 1 ? bufferMinutes * (sorted.length - 1) : 0;
    totalDurationMinutes += bufferTotal;

    const remainingMinutes = availableMinutes - totalDurationMinutes;
    const isOverload = remainingMinutes < 0;

    let suggestion: string | null = null;
    const suggestedMoves: TriageResult["suggestedMoves"] = [];

    if (isOverload) {
      const overflow = Math.abs(remainingMinutes);
      const lowPriority = sorted
        .filter((a) => !a.isFixed && a.priority <= 3)
        .sort((a, b) => a.priority - b.priority);

      let remainingOverflow = overflow;
      for (const act of lowPriority) {
        const duration =
          differenceInMinutes(
            new Date(act.endTime),
            new Date(act.startTime)
          ) + bufferMinutes;
        suggestedMoves.push({
          title: act.title ?? "Tugas",
          priority: act.priority,
          suggestedDate: getNextDay(dayStart),
        });
        remainingOverflow -= duration;
        if (remainingOverflow <= 0) break;
      }

      suggestion = `Kapasitas waktu Anda hari ini sudah penuh (overload ${overflow} menit). Pertimbangkan memindahkan tugas prioritas rendah ke esok hari.`;
    }

    return {
      isOverload,
      totalDurationMinutes,
      availableMinutes,
      remainingMinutes,
      suggestion,
      suggestedMoves,
    };
  }
}

function getNextDay(dayStart: Date): string {
  const next = new Date(dayStart);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
