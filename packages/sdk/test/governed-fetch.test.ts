import { describe, expect, it, vi } from "vitest";
import { encodePaymentResponseHeader } from "@x402/core/http";

import { createQusto } from "../src/client.js";
import { PolicyDeniedError } from "../src/errors.js";

const required = {
  accepts: [
    {
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      extra: { name: "USD Coin", version: "2" },
      maxTimeoutSeconds: 60,
      network: "eip155:8453",
      payTo: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scheme: "exact"
    }
  ],
  resource: { url: "https://api.example.com/data" },
  x402Version: 2
};

interface CapturedEvent {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly type: string;
}

function fetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function capturedEvents(
  calls: readonly (readonly [RequestInfo | URL, (RequestInit | undefined)?])[]
): CapturedEvent[] {
  const eventsCall = calls.find(([url]) =>
    fetchUrl(url).endsWith("/events/batch")
  );
  const body = eventsCall?.[1]?.body;
  if (typeof body !== "string") throw new Error("Event batch was not sent");
  return (JSON.parse(body) as { events: CapturedEvent[] }).events;
}

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
      .mockResolvedValueOnce(
        new Response("settlement failed", { status: 500 })
      );
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

    const response = await qusto.createGovernedFetch({
      signer,
      tool: "compute",
      transport
    })("https://api.example.com/data", { body: "input", method: "POST" });

    expect(await response.text()).toBe("settlement failed");
    expect(signer.createPaymentPayload).toHaveBeenCalledOnce();
    const retryHeaders = new Headers(transport.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get("payment-signature")).toBe("signed-payload");
    expect(transport.mock.calls[0]?.[1]?.body).toBeInstanceOf(ArrayBuffer);
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

  it.each(["payment-response", "x-payment-response"] as const)(
    "emits a submitted transaction and successful settlement from %s",
    async (headerName) => {
      const transactionHash = `0x${"ab".repeat(32)}`;
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            headers: {
              "payment-required": Buffer.from(
                JSON.stringify(required)
              ).toString("base64")
            },
            status: 402
          })
        )
        .mockResolvedValueOnce(
          new Response("paid", {
            headers: {
              [headerName]: encodePaymentResponseHeader({
                network: "eip155:8453",
                success: true,
                transaction: transactionHash
              })
            },
            status: 200
          })
        );
      const controlPlane = vi.fn<typeof fetch>(async (input) => {
        const url = fetchUrl(input);
        return url.endsWith("/policy/evaluate")
          ? Response.json({
              data: { decisionId: "dec-1", outcome: "allow", reasonCodes: [] },
              ok: true
            })
          : Response.json({ accepted: [], duplicates: [], rejected: [] });
      });
      const qusto = createQusto({
        apiKey: "fixture",
        baseUrl: "https://qusto.example.com",
        environment: "production",
        fetch: controlPlane
      });

      const response = await qusto.createGovernedFetch({
        signer: { createPaymentPayload: vi.fn().mockResolvedValue("signed") },
        transport
      })("https://api.example.com/data");
      await qusto.shutdown();

      expect(response.status).toBe(200);
      const events = capturedEvents(controlPlane.mock.calls);
      const submitted = events.find(
        ({ type }) => type === "settlement.submitted"
      );
      const succeeded = events.find(
        ({ type }) => type === "settlement.succeeded"
      );
      expect(submitted?.payload.transactionHash).toBe(transactionHash);
      expect(succeeded?.payload.transactionHash).toBe(transactionHash);
    }
  );

  it.each([
    ["malformed", "not-base64"],
    [
      "unsuccessful",
      encodePaymentResponseHeader({
        errorReason: "settlement_failed",
        network: "eip155:8453",
        success: false,
        transaction: ""
      })
    ],
    [
      "network-mismatched",
      encodePaymentResponseHeader({
        network: "eip155:84532",
        success: true,
        transaction: `0x${"cd".repeat(32)}`
      })
    ]
  ] as const)(
    "marks a present but %s settlement receipt as failed",
    async (_case, header) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            headers: {
              "payment-required": Buffer.from(
                JSON.stringify(required)
              ).toString("base64")
            },
            status: 402
          })
        )
        .mockResolvedValueOnce(
          new Response("paid", {
            headers: { "payment-response": header },
            status: 200
          })
        );
      const controlPlane = vi.fn<typeof fetch>(async (input) =>
        fetchUrl(input).endsWith("/policy/evaluate")
          ? Response.json({
              data: { decisionId: "dec-1", outcome: "allow", reasonCodes: [] },
              ok: true
            })
          : Response.json({ accepted: [], duplicates: [], rejected: [] })
      );
      const qusto = createQusto({
        apiKey: "fixture",
        baseUrl: "https://qusto.example.com",
        environment: "production",
        fetch: controlPlane
      });

      await qusto.createGovernedFetch({
        signer: { createPaymentPayload: vi.fn().mockResolvedValue("signed") },
        transport
      })("https://api.example.com/data");
      await qusto.shutdown();

      const events = capturedEvents(controlPlane.mock.calls);
      const failed = events.find(({ type }) => type === "settlement.failed");
      expect(failed?.payload.errorCode).toBe("INVALID_SETTLEMENT_RESPONSE");
    }
  );
});
