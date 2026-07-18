import type { AddressInfo } from "node:net";

import { normalizePaymentRequired } from "@qusto/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

import { loadSellerConfig } from "../src/config.js";
import { createSellerApp } from "../src/server.js";

const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) =>
              error === undefined ? resolve() : reject(error)
            )
          )
      )
  );
});

describe("test seller", () => {
  it("exposes an unprotected health endpoint", async () => {
    const app = createSellerApp(
      loadSellerConfig({
        SEPOLIA_E2E_PAY_TO: "0x2222222222222222222222222222222222222222"
      })
    );
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      network: "eip155:84532",
      ok: true
    });
  });

  it("returns a Base Sepolia x402 challenge for the weather endpoint", async () => {
    const actualFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://x402.org/facilitator/supported") {
        return Response.json({
          extensions: [],
          kinds: [
            {
              network: "eip155:84532",
              scheme: "exact",
              x402Version: 2
            }
          ],
          signers: {}
        });
      }
      return actualFetch(input, init);
    });
    const app = createSellerApp(
      loadSellerConfig({
        SEPOLIA_E2E_PAY_TO: "0x2222222222222222222222222222222222222222"
      })
    );
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const response = await actualFetch(
      `http://127.0.0.1:${String(port)}/weather`,
      { headers: { accept: "application/json" } }
    );

    expect(response.status).toBe(402);
    const header = response.headers.get("payment-required");
    expect(header).not.toBeNull();
    const challenge = normalizePaymentRequired(
      JSON.parse(Buffer.from(header ?? "", "base64").toString("utf8"))
    );
    expect(challenge.requirements[0]).toMatchObject({
      amountAtomic: "1000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      network: "eip155:84532",
      payTo: "0x2222222222222222222222222222222222222222"
    });
  });
});
