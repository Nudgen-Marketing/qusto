import { describe, expect, it } from "vitest";

import { resolveBaseNetwork } from "../src/index.js";

describe("resolveBaseNetwork", () => {
  it("defaults to Base mainnet and accepts canonical identifiers", () => {
    expect(resolveBaseNetwork()).toMatchObject({
      caip2: "eip155:8453",
      chainId: 8453,
      name: "base",
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    });
    expect(resolveBaseNetwork("eip155:8453").name).toBe("base");
  });

  it("resolves Base Sepolia from friendly and canonical identifiers", () => {
    const expected = {
      caip2: "eip155:84532",
      chainId: 84532,
      defaultRpcUrl: "https://sepolia.base.org",
      name: "base-sepolia",
      usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    } as const;

    expect(resolveBaseNetwork("base-sepolia")).toEqual(expected);
    expect(resolveBaseNetwork("eip155:84532")).toEqual(expected);
  });

  it("rejects unsupported network identifiers", () => {
    expect(() => resolveBaseNetwork("eip155:1")).toThrow(
      "BASE_NETWORK must be base or base-sepolia"
    );
  });
});
