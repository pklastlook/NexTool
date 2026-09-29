/**
 * Turnstile server-side token verification (Prompt2 §32).
 *
 * Browser widget is for UX only. The server MUST verify the token by POSTing
 * to Cloudflare's siteverify endpoint. Never trust the browser claim alone.
 *
 * HONEST: if TURNSTILE_SECRET_KEY is unset, returns `{success:true, skipped:true}`
 * and logs that verification was skipped. Callers can branch on `skipped`
 * (typically: allow through, but log to audit) — they MUST NOT silently treat
 * a missing config as a verified human.
 */
import { env } from "@/lib/env";

export interface TurnstileVerifyResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  /** Cloudflare's challenge transaction id, when present. */
  challengeId?: string;
}

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileVerifyResult> {
  // HONEST: no secret configured → return skipped + log.
  if (!env.TURNSTILE_SECRET_KEY) {
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY is not set — verification skipped. " +
      "Anti-bot protection is DISABLED. Set TURNSTILE_SECRET_KEY in production."
    );
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== "string" || token.length < 10) {
    return { success: false, error: "missing-token" };
  }

  try {
    const body = new URLSearchParams();
    body.append("secret", env.TURNSTILE_SECRET_KEY);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Cloudflare is fast but the network can hang — bound it.
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        error: `siteverify-status-${res.status}`,
      };
    }

    const json = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
      action?: string;
      cdata?: string;
    };

    if (!json.success) {
      return {
        success: false,
        error: json["error-codes"]?.join(",") ?? "turnstile-rejected",
      };
    }

    return {
      success: true,
      challengeId: json.challenge_ts ?? undefined,
    };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
    };
  }
}

/**
 * Get the client-side site key for rendering the Turnstile widget.
 * Returns null if not configured — callers should branch on this.
 */
export function getTurnstileSiteKey(): string | null {
  return env.TURNSTILE_SITE_KEY ?? null;
}
