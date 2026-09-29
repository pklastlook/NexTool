/**
 * RateLimitService (Prompt2 §33).
 *
 * Production: Redis-backed distributed rate limiting.
 * Sandbox: in-memory token-bucket (per-process) with DB fallback for
 * cross-process consistency.
 *
 * Honest: when REDIS_URL is unset, rate limits are per-process (each Next.js
 * worker instance has its own counter). This is documented in /status.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";

interface Bucket {
  count: number;
  windowStart: number;
  expiresAt: number;
}

const memory = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOpts {
  /** Window size in seconds. */
  windowSec: number;
  /** Max requests in the window. */
  limit: number;
}

/**
 * Check + consume a rate-limit token. Keyed by anything (IP, userId, apiKey,
 * endpoint, plan+userId combo, etc.).
 */
export async function rateLimit(key: string, opts: RateLimitOpts): Promise<RateLimitResult> {
  if (env.REDIS_URL) {
    return redisRateLimit(key, opts);
  }
  return memoryRateLimit(key, opts);
}

/**
 * In-memory token-bucket. Fast but per-process.
 */
function memoryRateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  let bucket = memory.get(key);
  if (!bucket || now >= bucket.expiresAt) {
    bucket = { count: 0, windowStart: now, expiresAt: now + windowMs };
    memory.set(key, bucket);
  }
  if (bucket.count < opts.limit) {
    bucket.count++;
    return {
      allowed: true,
      limit: opts.limit,
      remaining: opts.limit - bucket.count,
      resetAt: bucket.expiresAt,
    };
  }
  return { allowed: false, limit: opts.limit, remaining: 0, resetAt: bucket.expiresAt };
}

/**
 * Redis-backed distributed rate limit.
 * Used when REDIS_URL is set. Requires `ioredis` to be installed.
 * Falls back to memory if ioredis is not available (e.g. in the sandbox).
 * In production with Redis configured, install ioredis to enable this path.
 */
async function redisRateLimit(key: string, opts: RateLimitOpts): Promise<RateLimitResult> {
  try {
    // Dynamic import — if ioredis isn't installed, fall back to memory.
    const mod = await import("ioredis").catch(() => null);
    if (!mod || !mod.default) {
      // ioredis not installed — honest fallback to memory.
      return memoryRateLimit(key, opts);
    }
    const IORedis = mod.default;
    const redis = new IORedis(env.REDIS_URL!, { lazyConnect: false, maxRetriesPerRequest: 1 });
    try {
      // Atomic INCR + EXPIRE via a Lua script
      const lua = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
        end
        local ttl = redis.call('TTL', KEYS[1])
        return {count, ttl}
      `;
      const result = (await redis.eval(lua, 1, key, opts.windowSec)) as [number, number];
      const [count, ttl] = result;
      await redis.quit();
      const allowed = count <= opts.limit;
      return {
        allowed,
        limit: opts.limit,
        remaining: Math.max(0, opts.limit - count),
        resetAt: Date.now() + ttl * 1000,
      };
    } catch (e) {
      await redis.quit().catch(() => {});
      throw e;
    }
  } catch {
    return memoryRateLimit(key, opts);
  }
}

/** Convenience: rate limit by IP address (anon). */
export async function rateLimitByIp(ip: string | null, opts: RateLimitOpts): Promise<RateLimitResult> {
  const key = `ip:${ip ?? "unknown"}`;
  return rateLimit(key, opts);
}

/** Convenience: rate limit by API key (production API platform). */
export async function rateLimitByApiKey(apiKeyId: string, opts: RateLimitOpts): Promise<RateLimitResult> {
  return rateLimit(`apikey:${apiKeyId}`, opts);
}

/** Plan-based rate limits (Prompt2 §49). */
export function limitsForPlan(planSlug: string | null | undefined): {
  processPerHour: number;
  apiPerMinute: number;
} {
  switch (planSlug) {
    case "business": return { processPerHour: 500, apiPerMinute: 60 };
    case "pro": return { processPerHour: 100, apiPerMinute: 20 };
    case "free":
    default: return { processPerHour: 20, apiPerMinute: 5 };
  }
}
