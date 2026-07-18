import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizePaymentRequired } from "@qusto/contracts";
import { z } from "zod";

export interface QustoMcpDependencies {
  readonly governedFetch: typeof fetch;
  readonly safeFetch: typeof fetch;
  walletInfo(): Promise<Readonly<{ address: string; balanceAtomic: string }>>;
}

const text = (value: unknown) => ({
  content: [{ text: JSON.stringify(value, null, 2), type: "text" as const }]
});

async function parsePaymentRequired(response: Response): Promise<unknown> {
  const header = response.headers.get("payment-required");
  if (header !== null) {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  }
  return response.clone().json();
}

function responseHeaders(response: Response): Readonly<Record<string, string>> {
  const allowed = [
    "content-length",
    "content-type",
    "payment-response",
    "x-payment-response"
  ];
  return Object.fromEntries(
    allowed.flatMap((name) => {
      const value = response.headers.get(name);
      return value === null ? [] : [[name, value]];
    })
  );
}

export function createQustoMcpServer(
  dependencies: QustoMcpDependencies
): McpServer {
  const server = new McpServer({ name: "qusto-x402", version: "0.1.0" });

  server.registerTool(
    "governed_fetch",
    {
      annotations: { openWorldHint: true, readOnlyHint: false },
      description:
        "Make a Qusto-governed HTTP request and pay an x402 requirement only when policy allows it.",
      inputSchema: {
        body: z
          .string()
          .max(256 * 1024)
          .optional(),
        headers: z.record(z.string(), z.string()).optional(),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .default("GET"),
        tool: z.string().max(200).optional(),
        url: z.url()
      }
    },
    async ({ body, headers, method, tool, url }) => {
      const requestHeaders = new Headers(headers);
      for (const prohibited of [
        "authorization",
        "cookie",
        "host",
        "proxy-authorization"
      ]) {
        requestHeaders.delete(prohibited);
      }
      if (tool !== undefined) requestHeaders.set("x-qusto-tool", tool);
      const response = await dependencies.governedFetch(url, {
        headers: requestHeaders,
        method,
        ...(body === undefined ? {} : { body })
      });
      return text({
        body: await response.text(),
        headers: responseHeaders(response),
        status: response.status
      });
    }
  );

  server.registerTool(
    "inspect_x402_endpoint",
    {
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        "Inspect an HTTP endpoint's x402 price and accepted Base payment requirements without paying.",
      inputSchema: { url: z.url() }
    },
    async ({ url }) => {
      const response = await dependencies.safeFetch(url, { method: "GET" });
      if (response.status !== 402) {
        return text({ paymentRequired: false, status: response.status });
      }
      return text({
        paymentRequired: true,
        requirements: normalizePaymentRequired(
          await parsePaymentRequired(response)
        )
      });
    }
  );

  server.registerTool(
    "discover_x402",
    {
      annotations: { openWorldHint: true, readOnlyHint: true },
      description: "Read an origin's .well-known/x402 discovery document.",
      inputSchema: { origin: z.url() }
    },
    async ({ origin }) => {
      const discoveryUrl = new URL("/.well-known/x402", new URL(origin).origin);
      const response = await dependencies.safeFetch(discoveryUrl);
      if (!response.ok)
        throw new Error(`Discovery returned ${String(response.status)}`);
      return text(await response.json());
    }
  );

  server.registerTool(
    "wallet_info",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "Return the local wallet address and Base USDC balance. The private key never leaves this process."
    },
    async () => text(await dependencies.walletInfo())
  );

  return server;
}
