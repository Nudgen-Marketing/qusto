#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createQusto } from "@qusto/sdk";

import { loadMcpConfig } from "./config.js";
import { createSafeFetch } from "./safe-fetch.js";
import { createQustoMcpServer } from "./server.js";
import { createWalletInfo } from "./wallet.js";
import { createLocalX402Signer } from "./x402-signer.js";

async function main(): Promise<void> {
  const config = loadMcpConfig();
  const safeFetch = createSafeFetch({
    allowPrivateAddresses: config.allowPrivateAddresses,
    maxRedirects: 3,
    maxResponseBytes: 1024 * 1024,
    timeoutMs: 15_000
  });
  const qusto = createQusto({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    environment: config.environment
  });
  const walletInfo = createWalletInfo(config.privateKey, config.baseRpcUrl);
  const governedFetch = qusto.createGovernedFetch({
    signer: createLocalX402Signer(config.privateKey, async () =>
      BigInt((await walletInfo()).balanceAtomic)
    ),
    transport: safeFetch
  });
  const server = createQustoMcpServer({
    governedFetch,
    safeFetch,
    walletInfo
  });
  const transport = new StdioServerTransport();
  process.once("SIGINT", () => {
    void qusto.shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void qusto.shutdown().finally(() => process.exit(0));
  });
  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : "unknown",
      level: "error",
      message: "qusto_mcp.fatal"
    })
  );
  process.exitCode = 1;
});
