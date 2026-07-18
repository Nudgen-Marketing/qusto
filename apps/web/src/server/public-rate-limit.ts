import { createRateLimiter, type RateLimiter } from "./rate-limit";

export const evaluationLimiter = createRateLimiter({
  limit: 300,
  windowMs: 60_000
});
export const eventLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
export const reservationLimiter = createRateLimiter({
  limit: 300,
  windowMs: 60_000
});

export async function withRateLimit(
  request: Request,
  limiter: RateLimiter,
  operation: () => Promise<Response>
): Promise<Response> {
  const result = limiter.check(request);
  if (!result.allowed) {
    return Response.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
          requestId: crypto.randomUUID()
        },
        ok: false
      },
      {
        headers: { "Retry-After": String(result.retryAfterSeconds) },
        status: 429
      }
    );
  }
  return operation();
}
