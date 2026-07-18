import { describe, expect, it } from "vitest";

import { createRateLimiter } from "../src/server/rate-limit";

describe("public API rate limiter", () => {
  it("limits a hashed credential key without retaining the credential", () => {
    const limiter = createRateLimiter({
      limit: 2,
      now: () => 1_000,
      windowMs: 60_000
    });
    const request = new Request("https://qusto.example/api", {
      headers: { authorization: "Bearer qsk_sensitive-secret" }
    });

    expect(limiter.check(request)).toMatchObject({
      allowed: true,
      remaining: 1
    });
    expect(limiter.check(request)).toMatchObject({
      allowed: true,
      remaining: 0
    });
    expect(limiter.check(request)).toMatchObject({
      allowed: false,
      remaining: 0
    });
    expect(JSON.stringify(limiter.snapshot())).not.toContain(
      "sensitive-secret"
    );
  });

  it("resets counters after the configured window", () => {
    let now = 1_000;
    const limiter = createRateLimiter({
      limit: 1,
      now: () => now,
      windowMs: 100
    });
    const request = new Request("https://qusto.example/api", {
      headers: { "x-forwarded-for": "203.0.113.10" }
    });

    expect(limiter.check(request).allowed).toBe(true);
    expect(limiter.check(request).allowed).toBe(false);
    now = 1_101;
    expect(limiter.check(request).allowed).toBe(true);
  });
});
