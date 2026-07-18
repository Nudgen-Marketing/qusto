import { createHash } from "node:crypto";

interface RateLimitEntry {
  readonly count: number;
  readonly resetAt: number;
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

interface RateLimiterOptions {
  readonly limit: number;
  readonly now?: () => number;
  readonly windowMs: number;
}

function requestKey(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "anonymous";
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
  return createHash("sha256")
    .update(`${address}\0${authorization}`)
    .digest("base64url");
}

export function createRateLimiter(options: RateLimiterOptions) {
  const entries = new Map<string, RateLimitEntry>();
  const now = options.now ?? Date.now;

  return {
    check(request: Request): RateLimitResult {
      const timestamp = now();
      const key = requestKey(request);
      const current = entries.get(key);
      const entry =
        current === undefined || current.resetAt <= timestamp
          ? { count: 1, resetAt: timestamp + options.windowMs }
          : { count: current.count + 1, resetAt: current.resetAt };
      entries.set(key, entry);
      if (entries.size > 10_000) {
        for (const [candidate, value] of entries) {
          if (value.resetAt <= timestamp) entries.delete(candidate);
        }
      }
      return {
        allowed: entry.count <= options.limit,
        remaining: Math.max(0, options.limit - entry.count),
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetAt - timestamp) / 1_000)
        )
      };
    },
    snapshot(): readonly string[] {
      return [...entries.keys()];
    }
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
