/**
 * Cek apakah user boleh mengakses API AI.
 * - aiAccessEnabled = false → akses dinonaktifkan
 * - aiAccessExpiresAt != null && <= now → subscription kedaluwarsa
 * - aiAccessExpiresAt = null → akses permanen
 */
export type AIAccessUser = {
  aiAccessEnabled: boolean;
  aiAccessExpiresAt: Date | null;
};

export type AIAccessResult =
  | { ok: true }
  | {
      ok: false;
      reason: "DISABLED" | "EXPIRED";
      message: string;
      expiresAt?: string;
    };

export function checkAIAccess(user: AIAccessUser): AIAccessResult {
  if (!user.aiAccessEnabled) {
    return {
      ok: false,
      reason: "DISABLED",
      message: "Akses AI dinonaktifkan untuk akun Anda. Hubungi admin untuk mengaktifkan.",
    };
  }

  const expiresAt = user.aiAccessExpiresAt;
  if (expiresAt) {
    const now = new Date();
    if (expiresAt <= now) {
      return {
        ok: false,
        reason: "EXPIRED",
        message: "Subscription AI Anda telah kedaluwarsa. Perpanjang untuk melanjutkan akses.",
        expiresAt: expiresAt.toISOString(),
      };
    }
  }

  return { ok: true };
}
