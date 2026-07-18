import { describe, expect, it } from "vitest";

import { loadSellerConfig } from "../src/config.js";

const payTo = "0x2222222222222222222222222222222222222222";

describe("loadSellerConfig", () => {
  it("loads a fixed-price Base Sepolia seller", () => {
    expect(loadSellerConfig({ SEPOLIA_E2E_PAY_TO: payTo })).toMatchObject({
      facilitatorUrl: "https://x402.org/facilitator",
      network: { caip2: "eip155:84532" },
      payTo,
      port: 4021,
      price: "$0.001"
    });
  });

  it("rejects an invalid recipient or insecure facilitator", () => {
    expect(() =>
      loadSellerConfig({ SEPOLIA_E2E_PAY_TO: "not-an-address" })
    ).toThrow("SEPOLIA_E2E_PAY_TO");
    expect(() =>
      loadSellerConfig({
        SEPOLIA_E2E_FACILITATOR_URL: "http://facilitator.example",
        SEPOLIA_E2E_PAY_TO: payTo
      })
    ).toThrow("HTTPS");
  });
});
