import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";

import { createQustoMcpServer } from "../src/server.js";

describe("Qusto MCP server", () => {
  it("exposes only payment-client tools and executes wallet inspection", async () => {
    const server = createQustoMcpServer({
      governedFetch: vi.fn<typeof fetch>(),
      safeFetch: vi.fn<typeof fetch>(),
      walletInfo: vi
        .fn()
        .mockResolvedValue({ address: "0xabc", balanceAtomic: "1000000" })
    });
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name).sort()).toEqual([
      "discover_x402",
      "governed_fetch",
      "inspect_x402_endpoint",
      "wallet_info"
    ]);
    expect(
      tools.tools.some(
        ({ name }) => name.includes("policy") || name.includes("trace")
      )
    ).toBe(false);
    const result = await client.callTool({
      name: "wallet_info",
      arguments: {}
    });
    expect(JSON.stringify(result.content)).toContain("1000000");

    await Promise.all([client.close(), server.close()]);
  });
});
