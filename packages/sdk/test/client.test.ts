import { describe, expect, it, vi } from "vitest";

import { createQusto } from "../src/client.js";

const payment = {
  amountAtomic: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  network: "eip155:8453" as const,
  payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  phase: "buyer" as const,
  protocolVersion: 2 as const,
  resourceUrl: "https://api.example.com/data",
  scheme: "exact" as const
};

describe("createQusto", () => {
  it("evaluates before payment and batches lifecycle events", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          decisionId: "dec-1",
          outcome: "allow",
          reasonCodes: [],
          reservationExpiresAt: "2026-07-18T13:00:00.000Z",
          reservationId: "reservation-1"
        },
        ok: true
      })
    );
    const qusto = createQusto({
      apiKey: ["qsk", "fixture"].join("_"),
      baseUrl: "https://qusto.example.com",
      environment: "production",
      fetch: fetchMock
    });

    const result = await qusto.evaluate({ ...payment, tool: "market-data" });
    await qusto.shutdown();

    expect(result).toMatchObject({
      outcome: "allow",
      reservationId: "reservation-1"
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://qusto.example.com/api/public/v1/policy/evaluate"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://qusto.example.com/api/public/v1/events/batch"
    );
  });

  it("fails open in development and closed in production when Qusto is unavailable", async () => {
    const unavailable = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    const development = createQusto({
      apiKey: "fixture",
      baseUrl: "https://qusto.example.com",
      environment: "development",
      fetch: unavailable
    });
    const production = createQusto({
      apiKey: "fixture",
      baseUrl: "https://qusto.example.com",
      environment: "production",
      fetch: unavailable
    });

    await expect(development.evaluate(payment)).resolves.toMatchObject({
      outcome: "allow",
      reasonCodes: ["POLICY_UNAVAILABLE"]
    });
    await expect(production.evaluate(payment)).resolves.toMatchObject({
      outcome: "deny",
      reasonCodes: ["POLICY_UNAVAILABLE"]
    });
  });

  it("rejects evaluation timeouts above five seconds", () => {
    expect(() =>
      createQusto({
        apiKey: "fixture",
        baseUrl: "https://qusto.example.com",
        environment: "production",
        evaluationTimeoutMs: 5_001
      })
    ).toThrow("5 seconds");
  });
});
