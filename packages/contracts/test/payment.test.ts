import { describe, expect, it } from "vitest";

import {
  eventBatchSchema,
  normalizePaymentRequired,
  policyEvaluationRequestSchema
} from "../src/index.js";

describe("normalizePaymentRequired", () => {
  it("normalizes a v1 Base payment requirement", () => {
    const result = normalizePaymentRequired({
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "12500000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: { name: "USD Coin", version: "2" },
          payTo: "0x1111111111111111111111111111111111111111",
          resource: "https://api.example.com/v1/data",
          maxTimeoutSeconds: 60
        }
      ]
    });

    expect(result).toEqual({
      protocolVersion: 1,
      resourceUrl: "https://api.example.com/v1/data",
      requirements: [
        {
          amountAtomic: "12500000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: { name: "USD Coin", version: "2" },
          maxTimeoutSeconds: 60,
          network: "eip155:8453",
          payTo: "0x1111111111111111111111111111111111111111",
          scheme: "exact"
        }
      ]
    });
  });

  it("normalizes a v2 Base payment requirement", () => {
    const result = normalizePaymentRequired({
      x402Version: 2,
      resource: { url: "https://api.example.com/v1/compute" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "2500000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: {
            assetTransferMethod: "eip3009",
            name: "USD Coin",
            version: "2"
          },
          payTo: "0x2222222222222222222222222222222222222222",
          maxTimeoutSeconds: 30
        }
      ]
    });

    expect(result.protocolVersion).toBe(2);
    expect(result.requirements[0]?.amountAtomic).toBe("2500000");
    expect(result.requirements[0]?.extra).toEqual({
      assetTransferMethod: "eip3009",
      name: "USD Coin",
      version: "2"
    });

    const sourceExtra = requiredExtra();
    const normalized = normalizePaymentRequired({
      accepts: [
        {
          amount: "1",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          extra: sourceExtra,
          maxTimeoutSeconds: 30,
          network: "base-sepolia",
          payTo: "0x2222222222222222222222222222222222222222",
          scheme: "exact"
        }
      ],
      resource: { url: "https://api.example.com/testnet" },
      x402Version: 2
    });
    sourceExtra.name = "mutated";
    expect(normalized.requirements[0]).toMatchObject({
      extra: { name: "USD Coin", version: "2" },
      network: "eip155:84532"
    });
  });

  it("rejects unsupported networks and non-atomic amounts", () => {
    expect(() =>
      normalizePaymentRequired({
        x402Version: 2,
        resource: { url: "https://api.example.com" },
        accepts: [
          {
            scheme: "exact",
            network: "eip155:1",
            amount: "1.5",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            payTo: "0x2222222222222222222222222222222222222222",
            maxTimeoutSeconds: 30
          }
        ]
      })
    ).toThrow();
  });
});

function requiredExtra(): Record<string, unknown> {
  return { name: "USD Coin", version: "2" };
}

describe("public API contracts", () => {
  it("accepts a complete policy evaluation request", () => {
    const request = policyEvaluationRequestSchema.parse({
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
    });

    expect(request.amountAtomic).toBe("12500000");
  });

  it("rejects batches larger than 100 events and unsafe resource URLs", () => {
    const event = {
      eventId: "01JZ9M7ENM8WD8CQXT6BC44GYQ",
      occurredAt: "2026-07-18T04:00:00.000Z",
      payload: {},
      traceId: "01JZ9M7ENM8WD8CQXT6BC44GYR",
      type: "payment.required"
    };

    expect(() =>
      eventBatchSchema.parse({
        events: Array.from({ length: 101 }, () => event)
      })
    ).toThrow();
    expect(() =>
      policyEvaluationRequestSchema.parse({
        amountAtomic: "1",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        idempotencyKey: "pay_01JZ9M7ENM8WD8CQXT6BC44GYR",
        network: "eip155:8453",
        payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        phase: "buyer",
        protocolVersion: 2,
        resourceUrl: "file:///etc/passwd",
        scheme: "exact",
        traceId: "01JZ9M7ENM8WD8CQXT6BC44GYQ"
      })
    ).toThrow();
  });
});
