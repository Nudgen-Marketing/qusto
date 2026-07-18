import { describe, expect, it, vi } from "vitest";

import { reconcileTransaction } from "../src/reconciliation.js";

describe("Base transaction reconciliation", () => {
  it("emits confirmed and finalized only after the finalized head passes the receipt", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ blockNumber: "0x64", status: "0x1" })
      .mockResolvedValueOnce({ number: "0x65" });

    await expect(reconcileTransaction("0xtx", rpc)).resolves.toEqual([
      "chain.confirmed",
      "chain.finalized"
    ]);
  });

  it("emits reverted for a failed receipt and nothing while pending", async () => {
    await expect(
      reconcileTransaction(
        "0xtx",
        vi.fn().mockResolvedValue({ blockNumber: "0x64", status: "0x0" })
      )
    ).resolves.toEqual(["chain.reverted"]);
    await expect(
      reconcileTransaction("0xtx", vi.fn().mockResolvedValue(null))
    ).resolves.toEqual([]);
  });
});
