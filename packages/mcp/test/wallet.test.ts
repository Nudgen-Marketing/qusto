import { describe, expect, it, vi } from "vitest";

import { resolveBaseNetwork } from "@qusto/contracts";

import { createWalletInfo } from "../src/wallet.js";

const privateKey = `0x${"11".repeat(32)}`;

describe("createWalletInfo", () => {
  it("reads the configured network USDC balance", async () => {
    const readContract = vi.fn().mockResolvedValue(1_250_000n);
    const walletInfo = createWalletInfo({
      client: { readContract },
      network: resolveBaseNetwork("base-sepolia"),
      privateKey,
      rpcUrl: "https://sepolia.base.org"
    });

    await expect(walletInfo()).resolves.toMatchObject({
      balanceAtomic: "1250000",
      balanceUsdc: "1.25",
      network: "eip155:84532"
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
      })
    );
  });
});
