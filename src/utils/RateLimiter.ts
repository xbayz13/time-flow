/**
 * Simple in-memory rate limiter per user.
 * Used for AI endpoints to control cost and abuse.
 */
const store = new Map<
  string,
  { count: number; resetAt: number }
>();

export function checkAIRateLimit(
  userId: string,
  limit = 10,
  windowMs = 60_000
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry) {
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (now >= entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    ok: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
