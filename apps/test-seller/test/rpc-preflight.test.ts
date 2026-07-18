import { describe, expect, it, vi } from "vitest";

import { validateBaseSepoliaRpc } from "../src/rpc-preflight.js";

describe("validateBaseSepoliaRpc", () => {
  it("rejects a non-HTTP RPC URL as configuration", async () => {
    const request = vi.fn<typeof fetch>();

    await expect(
      validateBaseSepoliaRpc("file:///tmp/rpc", request)
    ).rejects.toThrow("Base Sepolia RPC configuration must use HTTP(S)");
    expect(request).not.toHaveBeenCalled();
  });

  it("accepts the Base Sepolia chain ID", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ result: "0x14a34" }));

    await expect(
      validateBaseSepoliaRpc("https://sepolia.base.org", request)
    ).resolves.toBeUndefined();
    expect(request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports an unavailable RPC service with its HTTP status", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("busy", { status: 503 }));

    await expect(
      validateBaseSepoliaRpc("https://sepolia.base.org", request)
    ).rejects.toThrow("Base Sepolia RPC service returned HTTP 503");
  });

  it("rejects a malformed JSON-RPC response", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(null));

    await expect(
      validateBaseSepoliaRpc("https://sepolia.base.org", request)
    ).rejects.toThrow("Base Sepolia RPC service returned an invalid response");
  });

  it("reports transport failures without exposing endpoint details", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("request to secret-provider-key failed"));

    await expect(
      validateBaseSepoliaRpc("https://sepolia.base.org", request)
    ).rejects.toThrow(/^Base Sepolia RPC service request failed$/);
  });

  it("reports a wrong-chain RPC as a configuration error", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ result: "0x2105" }));

    await expect(
      validateBaseSepoliaRpc("https://sepolia.base.org", request)
    ).rejects.toThrow(
      "Base Sepolia RPC configuration returned chain ID 0x2105; expected 0x14a34"
    );
  });
});
