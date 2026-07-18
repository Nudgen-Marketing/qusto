import { describe, expect, it } from "vitest";

import {
  signWebhook,
  verifyWebhookSignature
} from "../src/webhook-signature.js";

describe("webhook signatures", () => {
  it("signs the exact timestamp and payload with HMAC-SHA256", () => {
    const signed = signWebhook(
      "delivery-1",
      "1700000000",
      '{"type":"policy.denied"}',
      "fixture-value"
    );

    expect(signed.headers["x-qusto-delivery-id"]).toBe("delivery-1");
    expect(signed.headers["x-qusto-signature"]).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(
      verifyWebhookSignature(
        signed.body,
        signed.headers,
        "fixture-value",
        1_700_000_000_000
      )
    ).toBe(true);
  });

  it("rejects tampered payloads and stale deliveries", () => {
    const signed = signWebhook(
      "delivery-1",
      "1700000000",
      "{}",
      "fixture-value"
    );

    expect(
      verifyWebhookSignature(
        '{"tampered":true}',
        signed.headers,
        "fixture-value",
        1_700_000_000_000
      )
    ).toBe(false);
    expect(
      verifyWebhookSignature(
        signed.body,
        signed.headers,
        "fixture-value",
        1_700_001_000_000
      )
    ).toBe(false);
  });
});
