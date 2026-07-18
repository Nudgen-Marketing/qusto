import { describe, expect, it, vi } from "vitest";

import { createPublicApi } from "../src/server/public-api.js";

const validEvaluation = {
  amountAtomic: "12500000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  idempotencyKey: "pay_01JZ9M7ENM8WD8CQXT6BC44GYR",
  network: "eip155:8453",
  payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  phase: "buyer",
  protocolVersion: 2,
  resourceUrl: "https://api.example.com/v1/data",
  scheme: "exact",
  traceId: "01JZ9M7ENM8WD8CQXT6BC44GYQ"
};

describe("public API", () => {
  it("returns a stable unauthorized envelope without a bearer key", async () => {
    const api = createPublicApi({
      authenticate: vi.fn(),
      evaluate: vi.fn(),
      ingest: vi.fn()
    });

    const response = await api.evaluate(
      new Request("http://localhost/api/public/v1/policy/evaluate", {
        body: JSON.stringify(validEvaluation),
        method: "POST"
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHORIZED" },
      ok: false
    });
  });

  it("validates policy requests before invoking the service", async () => {
    const evaluate = vi.fn();
    const api = createPublicApi({
      authenticate: vi.fn().mockResolvedValue({ environmentId: "env_prod" }),
      evaluate,
      ingest: vi.fn()
    });
    const response = await api.evaluate(
      new Request("http://localhost/api/public/v1/policy/evaluate", {
        body: JSON.stringify({ ...validEvaluation, amountAtomic: "1.2" }),
        headers: { authorization: "Bearer qsk_lookup_secret" },
        method: "POST"
      })
    );

    expect(response.status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns an allowed policy decision", async () => {
    const api = createPublicApi({
      authenticate: vi.fn().mockResolvedValue({ environmentId: "env_prod" }),
      evaluate: vi.fn().mockResolvedValue({
        decisionId: "dec_1",
        outcome: "allow",
        policyVersionId: "pv_1",
        reasonCodes: []
      }),
      ingest: vi.fn()
    });
    const response = await api.evaluate(
      new Request("http://localhost/api/public/v1/policy/evaluate", {
        body: JSON.stringify(validEvaluation),
        headers: { authorization: "Bearer qsk_lookup_secret" },
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        decisionId: "dec_1",
        outcome: "allow",
        policyVersionId: "pv_1",
        reasonCodes: []
      },
      ok: true
    });
  });

  it("ingests an authenticated event batch", async () => {
    const ingest = vi.fn().mockResolvedValue({
      accepted: ["event_0000000000000001"],
      duplicates: [],
      rejected: []
    });
    const api = createPublicApi({
      authenticate: vi.fn().mockResolvedValue({ environmentId: "env_prod" }),
      evaluate: vi.fn(),
      ingest
    });
    const response = await api.events(
      new Request("http://localhost/api/public/v1/events/batch", {
        body: JSON.stringify({
          events: [
            {
              eventId: "event_0000000000000001",
              occurredAt: "2026-07-18T04:00:00.000Z",
              payload: {},
              traceId: "trace_0000000000000001",
              type: "payment.required"
            }
          ]
        }),
        headers: { authorization: "Bearer qsk_lookup_secret" },
        method: "POST"
      })
    );

    expect(response.status).toBe(202);
    expect(ingest).toHaveBeenCalledWith(
      "env_prod",
      expect.arrayContaining([expect.objectContaining({ type: "payment.required" })])
    );
  });
});
