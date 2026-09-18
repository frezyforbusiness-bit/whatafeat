import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = "auth" | "message" | "proposal" | "upload" | "report";

/**
 * Upstash sliding-window limits. No-ops when Redis env is unset.
 * Applied from Node server actions and `/api/blob/upload` (not Edge middleware —
 * the Redis SDK is Node-oriented).
 *
 * `auth` bucket is reserved for future Auth.js hooks; sign-in abuse is also
 * constrained by Google OAuth.
 */

const LIMITS: Record<Bucket, { requests: number; window: `${number} s` | `${number} m` | `${number} h` }> = {
  auth: { requests: 20, window: "10 m" },
  message: { requests: 60, window: "1 m" },
  proposal: { requests: 20, window: "10 m" },
  upload: { requests: 30, window: "10 m" },
  report: { requests: 10, window: "60 m" },
};

let redis: Redis | null = null;
const limiters = new Map<Bucket, Ratelimit>();

function client() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

function limiter(bucket: Bucket) {
  const existing = limiters.get(bucket);
  if (existing) return existing;
  const r = client();
  if (!r) return null;
  const cfg = LIMITS[bucket];
  const created = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
    prefix: `whatafeat:${bucket}`,
    analytics: false,
  });
  limiters.set(bucket, created);
  return created;
}

/**
 * Returns true when the caller may proceed. When Upstash is not configured,
 * all requests pass (local demo / early soft launch).
 */
export async function assertRateLimit(bucket: Bucket, key: string) {
  const l = limiter(bucket);
  if (!l) return;
  const result = await l.limit(key);
  if (!result.success) {
    throw new Error("Too many requests. Slow down and try again.");
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
