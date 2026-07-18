import { describe, expect, it, vi } from "vitest";

import { resolveBaseNetwork } from "@qusto/contracts";

import { validateBaseRpcNetwork } from "../src/rpc.js";

describe("validateBaseRpcNetwork", () => {
  it("accepts the configured chain ID", async () => {
    const rpc = vi.fn().mockResolvedValue("0x14a34");

    await expect(
      validateBaseRpcNetwork(rpc, resolveBaseNetwork("base-sepolia"))
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("eth_chainId", []);
  });

  it("rejects an RPC connected to another Base network", async () => {
    await expect(
      validateBaseRpcNetwork(
        vi.fn().mockResolvedValue("0x2105"),
        resolveBaseNetwork("base-sepolia")
      )
    ).rejects.toThrow(
      "BASE_RPC_URL returned chain ID 0x2105; expected 0x14a34"
    );
  });
});
