import { describe, expect, it, vi } from "vitest";

import { deliverWebhook } from "../src/webhook-delivery.js";

describe("webhook delivery", () => {
  it("sends a timestamped signed metadata payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deliverWebhook(
      {
        deliveryId: "delivery-1",
        payload: { traceId: "trace-1", type: "policy.denied", version: 1 },
        secret: ["fixture", "value"].join("-"),
        url: "https://hooks.example.com/qusto"
      },
      { fetch: fetchMock, now: () => new Date("2026-07-18T00:00:00.000Z") }
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("https://hooks.example.com/qusto");
    expect(call?.[1]?.method).toBe("POST");
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get("x-qusto-delivery-id")).toBe("delivery-1");
    expect(headers.get("x-qusto-signature")).toMatch(/^v1=/);
  });

  it("retries through the queue when the receiver is not successful", async () => {
    await expect(
      deliverWebhook(
        {
          deliveryId: "delivery-1",
          payload: {},
          secret: ["fixture", "value"].join("-"),
          url: "https://hooks.example.com/qusto"
        },
        {
          fetch: vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
        }
      )
    ).rejects.toThrow("Webhook receiver returned 503");
  });
});
