import { describe, expect, it, vi } from "vitest";

import { resolveSafeTarget } from "../src/safe-fetch.js";

describe("MCP outbound network policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1"
  ])("blocks private or link-local address %s", async (address) => {
    await expect(
      resolveSafeTarget("https://example.com/data", {
        lookup: vi
          .fn()
          .mockResolvedValue([
            { address, family: address.includes(":") ? 6 : 4 }
          ])
      })
    ).rejects.toThrow(/private/i);
  });

  it("pins a public resolved address and rejects embedded credentials", async () => {
    await expect(
      resolveSafeTarget("https://example.com/data", {
        lookup: vi
          .fn()
          .mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
      })
    ).resolves.toMatchObject({
      address: "93.184.216.34",
      hostname: "example.com"
    });
    await expect(
      resolveSafeTarget("https://user:pass@example.com/data")
    ).rejects.toThrow("credentials");
  });

  it("allows private development endpoints only with an explicit override", async () => {
    await expect(
      resolveSafeTarget("http://localhost:3000", {
        allowPrivateAddresses: true,
        lookup: vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }])
      })
    ).resolves.toMatchObject({ address: "127.0.0.1" });
  });
});
