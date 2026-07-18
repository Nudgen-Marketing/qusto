import { describe, expect, it, vi } from "vitest";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { resolveBaseNetwork } from "@qusto/contracts";

import { createLocalX402Signer } from "../src/x402-signer";

const privateKey = `0x${"11".repeat(32)}`;

describe("local x402 signer", () => {
  it("rejects payment before signing when Base USDC is insufficient", async () => {
    const balance = vi.fn().mockResolvedValue(999n);
    const signer = createLocalX402Signer(privateKey, {
      balanceAtomic: balance,
      network: resolveBaseNetwork()
    });

    await expect(
      signer.createPaymentPayload({
        protocolVersion: 2,
        requirement: {
          amountAtomic: "1000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: { name: "USD Coin", version: "2" },
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

  it("signs Base Sepolia requirements with preserved EIP-712 metadata", async () => {
    const network = resolveBaseNetwork("base-sepolia");
    const signer = createLocalX402Signer(privateKey, {
      balanceAtomic: vi.fn().mockResolvedValue(10_000n),
      network
    });

    const encoded = await signer.createPaymentPayload({
      protocolVersion: 2,
      requirement: {
        amountAtomic: "1000",
        asset: network.usdcAddress,
        extra: { name: "USD Coin", version: "2" },
        maxTimeoutSeconds: 60,
        network: network.caip2,
        payTo: "0x2222222222222222222222222222222222222222",
        scheme: "exact"
      },
      resourceUrl: "https://paid.example/resource",
      traceId: "trace-sepolia"
    });

    expect(decodePaymentSignatureHeader(encoded)).toMatchObject({
      accepted: {
        asset: network.usdcAddress,
        extra: { name: "USD Coin", version: "2" },
        network: "eip155:84532"
      },
      x402Version: 2
    });
  });

  it("signs canonical Base Sepolia requirements with the v1 network name", async () => {
    const network = resolveBaseNetwork("base-sepolia");
    const signer = createLocalX402Signer(privateKey, { network });

    const encoded = await signer.createPaymentPayload({
      protocolVersion: 1,
      requirement: {
        amountAtomic: "1000",
        asset: network.usdcAddress,
        extra: { name: "USD Coin", version: "2" },
        maxTimeoutSeconds: 60,
        network: network.caip2,
        payTo: "0x2222222222222222222222222222222222222222",
        scheme: "exact"
      },
      resourceUrl: "https://paid.example/resource",
      traceId: "trace-sepolia-v1"
    });

    expect(decodePaymentSignatureHeader(encoded).x402Version).toBe(1);
  });

  it("rejects a requirement for a different network or token", async () => {
    const signer = createLocalX402Signer(privateKey, {
      network: resolveBaseNetwork("base-sepolia")
    });
    const requirement = {
      amountAtomic: "1000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      extra: { name: "USD Coin", version: "2" },
      maxTimeoutSeconds: 60,
      network: "eip155:8453" as const,
      payTo: "0x2222222222222222222222222222222222222222",
      scheme: "exact" as const
    };

    await expect(
      signer.createPaymentPayload({
        protocolVersion: 2,
        requirement,
        resourceUrl: "https://paid.example/resource",
        traceId: "trace-mismatch"
      })
    ).rejects.toThrow("does not match configured network");
  });

  it("reports missing EIP-712 token metadata before signing", async () => {
    const network = resolveBaseNetwork("base-sepolia");
    const signer = createLocalX402Signer(privateKey, { network });

    await expect(
      signer.createPaymentPayload({
        protocolVersion: 2,
        requirement: {
          amountAtomic: "1000",
          asset: network.usdcAddress,
          extra: {},
          maxTimeoutSeconds: 60,
          network: network.caip2,
          payTo: "0x2222222222222222222222222222222222222222",
          scheme: "exact"
        },
        resourceUrl: "https://paid.example/resource",
        traceId: "trace-missing-metadata"
      })
    ).rejects.toThrow(
      "Payment requirement extra.name and extra.version are required"
    );
  });
});
