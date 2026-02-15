import { addMinutes, differenceInMinutes } from "date-fns";

export interface ActivitySlot {
  startTime: Date;
  endTime: Date;
  category?: string;
  title?: string;
}

export interface BurnoutWarning {
  start: string;
  end: string;
  continuousMinutes: number;
  suggestion: string;
}

const WORK_CATEGORIES = ["deep_work", "admin"] as const;
const MAX_CONTINUOUS_WORK_MINUTES = 180; // 3 hours

/**
 * Detects periods of >3 hours continuous work (without health/social breaks).
 * Suggests inserting "Rest Block" or "Short Break".
 */
export class BurnoutDetector {
  static detect(
    activities: ActivitySlot[],
    bufferMinutes: number
  ): BurnoutWarning[] {
    const warnings: BurnoutWarning[] = [];
    const sorted = [...activities].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let workStart: Date | null = null;
    let workEnd: Date | null = null;

    for (const act of sorted) {
      const start = new Date(act.startTime);
      const end = new Date(act.endTime);
      const isWork = WORK_CATEGORIES.includes(
        (act.category ?? "admin") as (typeof WORK_CATEGORIES)[number]
      );

      if (isWork) {
        if (workStart === null) {
          workStart = start;
          workEnd = end;
        } else {
          const gap = differenceInMinutes(start, workEnd!);
          if (gap <= bufferMinutes + 5) {
            workEnd = end;
          } else {
            const duration = differenceInMinutes(workEnd!, workStart!);
            if (duration >= MAX_CONTINUOUS_WORK_MINUTES) {
              warnings.push({
                start: workStart.toISOString(),
                end: workEnd!.toISOString(),
                continuousMinutes: duration,
                suggestion: `Sisipkan "Short Break" atau "Stretch Break" setelah ${workEnd!.toISOString()}`,
              });
            }
            workStart = start;
            workEnd = end;
          }
        }
      } else {
        const duration =
          workStart && workEnd
            ? differenceInMinutes(workEnd, workStart)
            : 0;
        if (duration >= MAX_CONTINUOUS_WORK_MINUTES) {
          warnings.push({
            start: workStart!.toISOString(),
            end: workEnd!.toISOString(),
            continuousMinutes: duration,
            suggestion: `Sisipkan "Short Break" setelah ${workEnd!.toISOString()}`,
          });
        }
        workStart = null;
        workEnd = null;
      }
    }

    if (workStart && workEnd) {
      const duration = differenceInMinutes(workEnd, workStart);
      if (duration >= MAX_CONTINUOUS_WORK_MINUTES) {
        warnings.push({
          start: workStart.toISOString(),
          end: workEnd.toISOString(),
          continuousMinutes: duration,
          suggestion: `Sisipkan "Short Break" setelah ${workEnd.toISOString()}`,
        });
      }
    }

    return warnings;
  }
}
