import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const DEFAULT_TZ = "Asia/Jakarta";

const normTz = (tz?: string | null) => (tz && tz.trim() ? tz : DEFAULT_TZ);

/**
 * Parse input datetime string sebagai waktu lokal user → UTC Date untuk disimpan ke DB.
 * Format input: YYYY-MM-DDTHH:mm atau YYYY-MM-DD HH:mm:ss (tanpa suffix timezone).
 * Suffix Z/+offset akan di-strip dan dianggap sebagai waktu lokal user.
 */
export function parseInputAsUserTz(value: string, timezone?: string | null): Date {
  const tz = normTz(timezone);
  const s = value.replace(/Z$|[+-]\d{2}:?\d{2}$/i, "").trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  return fromZonedTime(normalized, tz);
}

/**
 * Format Date (UTC dari DB) ke ISO string di timezone user, e.g. "2026-02-18T09:00:00+07:00".
 */
export function toUserTzISO(date: Date, timezone?: string | null): string {
  const tz = normTz(timezone);
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Mendapatkan batas hari (00:00 - 23:59:59.999) di timezone user, dikonversi ke UTC.
 * Dipakai untuk query schedule agar "tanggal" sesuai dengan kalender lokal user.
 */
export function getDayBoundsInTimezone(
  date: string,
  timezone?: string | null
): { dayStart: Date; dayEnd: Date } {
  const tz = normTz(timezone);
  const dayStart = fromZonedTime(`${date}T00:00:00.000`, tz);
  const dayEnd = fromZonedTime(`${date}T23:59:59.999`, tz);
  return { dayStart, dayEnd };
}

/**
 * Mendapatkan tanggal YYYY-MM-DD di timezone user dari Date (UTC).
 */
export function getDateInTimezone(
  date: Date,
  timezone?: string | null
): string {
  const tz = normTz(timezone);
  return Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
