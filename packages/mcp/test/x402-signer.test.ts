import { describe, expect, it, vi } from "vitest";

import { createLocalX402Signer } from "../src/x402-signer";

const privateKey = `0x${"11".repeat(32)}`;

describe("local x402 signer", () => {
  it("rejects payment before signing when Base USDC is insufficient", async () => {
    const balance = vi.fn().mockResolvedValue(999n);
    const signer = createLocalX402Signer(privateKey, balance);

    await expect(
      signer.createPaymentPayload({
        protocolVersion: 2,
        requirement: {
          amountAtomic: "1000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          maxTimeoutSeconds: 60,
          network: "eip155:8453",
          payTo: "0x2222222222222222222222222222222222222222",
          scheme: "exact"
        },
        resourceUrl: "https://paid.example/resource",
        traceId: "trace-insufficient-balance"
      })
    ).rejects.toThrow("Insufficient Base USDC balance");
    expect(balance).toHaveBeenCalledOnce();
  });
});
