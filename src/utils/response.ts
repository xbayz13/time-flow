/**
 * Format response standar untuk API
 * - Error: { error, code?, message?, timestamp, ...extras }
 * - Success: { success: true, ...data, message?, timestamp }
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "BAD_REQUEST"
  | "AI_ACCESS_DENIED";

export function jsonError(
  status: number,
  error: string,
  message?: string,
  extras?: Record<string, unknown>,
  code?: ErrorCode
): Response {
  return new Response(
    JSON.stringify({
      error,
      ...(code && { code }),
      ...(message && { message }),
      timestamp: new Date().toISOString(),
      ...extras,
    }),
    { status, headers: JSON_HEADERS }
  );
}

/** Untuk route yang pakai set.status + return object */
export function errorObj(
  error: string,
  message?: string,
  extras?: Record<string, unknown>,
  code?: ErrorCode
) {
  return {
    error,
    ...(code && { code }),
    ...(message && { message }),
    timestamp: new Date().toISOString(),
    ...extras,
  };
}

/** Response sukses standar dengan optional message */
export function successObj<T extends Record<string, unknown>>(
  data: T,
  message?: string
): T & { success: true; message?: string; timestamp: string } {
  return {
    ...data,
    success: true,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  } as T & { success: true; message?: string; timestamp: string };
}
