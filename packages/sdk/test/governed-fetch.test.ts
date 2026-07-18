import { describe, expect, it, vi } from "vitest";

import { createQusto } from "../src/client.js";
import { PolicyDeniedError } from "../src/errors.js";

const required = {
  accepts: [
    {
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      maxTimeoutSeconds: 60,
      network: "eip155:8453",
      payTo: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scheme: "exact"
    }
  ],
  resource: { url: "https://api.example.com/data" },
  x402Version: 2
};

describe("governed fetch", () => {
  it("evaluates before invoking the external signer and retries with a v2 payment header", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            "payment-required": Buffer.from(JSON.stringify(required)).toString(
              "base64"
            )
          },
          status: 402
        })
      )
      .mockResolvedValueOnce(new Response("paid", { status: 200 }));
    const controlPlane = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: { decisionId: "dec-1", outcome: "allow", reasonCodes: [] },
        ok: true
      })
    );
    const signer = {
      createPaymentPayload: vi.fn().mockResolvedValue("signed-payload")
    };
    const qusto = createQusto({
      apiKey: "fixture",
      baseUrl: "https://qusto.example.com",
      environment: "production",
      fetch: controlPlane
    });

    const response = await qusto.createGovernedFetch({ signer, transport })(
      "https://api.example.com/data"
    );

    expect(await response.text()).toBe("paid");
    expect(signer.createPaymentPayload).toHaveBeenCalledOnce();
    const retryHeaders = new Headers(transport.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get("payment-signature")).toBe("signed-payload");
  });

  it("never invokes the signer when policy denies", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        headers: {
          "payment-required": Buffer.from(JSON.stringify(required)).toString(
            "base64"
          )
        },
        status: 402
      })
    );
    const signer = { createPaymentPayload: vi.fn() };
    const qusto = createQusto({
      apiKey: "fixture",
      baseUrl: "https://qusto.example.com",
      environment: "production",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: {
            decisionId: "dec-1",
            outcome: "deny",
            reasonCodes: ["MAX_AMOUNT_EXCEEDED"]
          },
          ok: true
        })
      )
    });

    await expect(
      qusto.createGovernedFetch({ signer, transport })(
        "https://api.example.com/data"
      )
    ).rejects.toBeInstanceOf(PolicyDeniedError);
    expect(signer.createPaymentPayload).not.toHaveBeenCalled();
  });
});
