import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApiKey } from "@qusto/control-plane";
import {
  createLocalX402Signer,
  createQustoMcpServer,
  createSafeFetch,
  createWalletInfo,
  loadMcpConfig
} from "@qusto/mcp";
import { createQusto } from "@qusto/sdk";
import { decodePaymentResponseHeader } from "@x402/core/http";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateBaseSepoliaRpc } from "../src/rpc-preflight.js";

interface SeededEnvironment {
  readonly apiKey: string;
  readonly environmentId: string;
  readonly organizationId: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for Base Sepolia E2E`);
  }
  return value;
}

async function seedEnvironment(sql: postgres.Sql): Promise<SeededEnvironment> {
  const apiKey = createApiKey();
  const suffix = randomUUID().replaceAll("-", "");
  return sql.begin(async (transaction) => {
    const [organization] = await transaction<{ id: string }[]>`
      INSERT INTO organizations (name) VALUES (${`Sepolia E2E ${suffix}`}) RETURNING id
    `;
    if (organization === undefined)
      throw new Error("E2E organization setup failed");
    const [project] = await transaction<{ id: string }[]>`
      INSERT INTO projects (organization_id, name, slug)
      VALUES (${organization.id}, 'Sepolia E2E', ${`sepolia-e2e-${suffix}`}) RETURNING id
    `;
    if (project === undefined) throw new Error("E2E project setup failed");
    const [environment] = await transaction<{ id: string }[]>`
      INSERT INTO environments (project_id, name, fail_mode)
      VALUES (${project.id}, 'development', 'closed') RETURNING id
    `;
    if (environment === undefined)
      throw new Error("E2E environment setup failed");
    const rules = [
      {
        id: "sepolia-e2e-max",
        kind: "max-amount",
        maxAmountAtomic: "1000",
        phases: ["buyer"]
      }
    ];
    const [policy] = await transaction<{ id: string }[]>`
      INSERT INTO policy_versions (
        environment_id, version, status, rules, published_at
      ) VALUES (
        ${environment.id}, 1, 'published', ${transaction.json(rules)}::jsonb, now()
      ) RETURNING id
    `;
    if (policy === undefined) throw new Error("E2E policy setup failed");
    await transaction`
      UPDATE environments SET active_policy_version_id = ${policy.id}
      WHERE id = ${environment.id}
    `;
    await transaction`
      INSERT INTO api_keys (environment_id, name, lookup, secret_hash)
      VALUES (
        ${environment.id}, 'Sepolia E2E', ${apiKey.lookup}, ${apiKey.secretHash}
      )
    `;
    return {
      apiKey: apiKey.token,
      environmentId: environment.id,
      organizationId: organization.id
    };
  });
}

async function waitFor(
  description: string,
  assertion: () => Promise<boolean>,
  timeoutMs = 180_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function toolResult(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || !("content" in value)) {
    throw new Error("MCP tool returned an invalid result");
  }
  const content = value.content;
  if (!Array.isArray(content)) throw new Error("MCP tool returned no content");
  const text = content.find(
    (item): item is { text: string; type: "text" } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
  );
  if (text === undefined) throw new Error("MCP tool returned no text content");
  return JSON.parse(text.text) as Record<string, unknown>;
}

describe("Base Sepolia governed payment", () => {
  const sellerUrl =
    process.env.SEPOLIA_E2E_SELLER_URL ?? "http://seller:4021/weather";
  const qustoUrl = process.env.QUSTO_BASE_URL ?? "http://web:3000";
  let rpcUrl!: string;
  let seed!: SeededEnvironment;
  let sql!: postgres.Sql;

  beforeAll(async () => {
    if (process.env.RUN_SEPOLIA_E2E !== "true") {
      throw new Error("RUN_SEPOLIA_E2E=true is required");
    }
    if (process.env.BASE_NETWORK !== "base-sepolia") {
      throw new Error("BASE_NETWORK=base-sepolia is required");
    }
    rpcUrl = required("BASE_RPC_URL");
    sql = postgres(required("DATABASE_URL"), { max: 2 });
    await validateBaseSepoliaRpc(rpcUrl);
    const ready = await fetch(`${qustoUrl}/api/health/ready`);
    if (!ready.ok) throw new Error("Qusto web service is not ready");
    await waitFor(
      "a current worker heartbeat",
      async () => {
        const [heartbeat] = await sql<{ ready: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM worker_heartbeats
          WHERE last_seen_at > now() - interval '10 seconds'
        ) AS ready
      `;
        return heartbeat?.ready === true;
      },
      30_000
    );
    seed = await seedEnvironment(sql);
  });

  afterAll(async () => {
    if (seed !== undefined && process.env.SEPOLIA_E2E_KEEP_DATA !== "true") {
      await sql`
        DELETE FROM jobs WHERE payload->>'environmentId' = ${seed.environmentId}
      `;
      await sql`DELETE FROM organizations WHERE id = ${seed.organizationId}`;
    }
    if (sql !== undefined) await sql.end();
  });

  it("settles and reconciles a policy-approved payment", async () => {
    const config = loadMcpConfig({
      ...process.env,
      BASE_NETWORK: "base-sepolia",
      BASE_RPC_URL: rpcUrl,
      QUSTO_API_KEY: seed.apiKey,
      QUSTO_BASE_URL: qustoUrl,
      QUSTO_ENVIRONMENT: "development",
      QUSTO_MCP_ALLOW_PRIVATE: "true"
    });
    const walletInfo = createWalletInfo({
      network: config.baseNetwork,
      privateKey: config.privateKey,
      rpcUrl: config.baseRpcUrl
    });
    const wallet = await walletInfo();
    if (BigInt(wallet.balanceAtomic) < 1_000n) {
      throw new Error("Base Sepolia wallet needs at least 0.001 test USDC");
    }
    const safeFetch = createSafeFetch({
      allowPrivateAddresses: true,
      maxRedirects: 0,
      maxResponseBytes: 1024 * 1024,
      timeoutMs: 30_000
    });
    const qusto = createQusto({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      environment: "development"
    });
    const governedFetch = qusto.createGovernedFetch({
      signer: createLocalX402Signer(config.privateKey, {
        balanceAtomic: async () => BigInt((await walletInfo()).balanceAtomic),
        network: config.baseNetwork
      }),
      transport: safeFetch
    });
    const server = createQustoMcpServer({
      governedFetch,
      safeFetch,
      walletInfo
    });
    const client = new Client({ name: "qusto-sepolia-e2e", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    try {
      const inspection = toolResult(
        await client.callTool({
          arguments: { url: sellerUrl },
          name: "inspect_x402_endpoint"
        })
      );
      const requirement = (
        inspection.requirements as {
          requirements: Array<Record<string, unknown>>;
        }
      ).requirements[0];
      expect(requirement).toMatchObject({
        amountAtomic: "1000",
        asset: config.baseNetwork.usdcAddress,
        network: config.baseNetwork.caip2,
        payTo: required("SEPOLIA_E2E_PAY_TO")
      });

      const result = toolResult(
        await client.callTool({
          arguments: { url: sellerUrl },
          name: "governed_fetch"
        })
      );
      expect(result.status).toBe(200);
      const headers = result.headers as Record<string, string>;
      const receipt = decodePaymentResponseHeader(
        headers["payment-response"] ?? ""
      );
      expect(receipt).toMatchObject({
        network: config.baseNetwork.caip2,
        success: true
      });
      expect(receipt.transaction).toMatch(/^0x[a-fA-F0-9]{64}$/);

      await qusto.shutdown();
      const [job] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count FROM jobs
        WHERE type = 'chain.reconcile'
          AND payload->>'environmentId' = ${seed.environmentId}
          AND payload->>'transactionHash' = ${receipt.transaction}
      `;
      expect(job?.count).toBe(1);
      await waitFor("Qusto chain.confirmed telemetry", async () => {
        const [confirmed] = await sql<{ confirmed: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM trace_events
            WHERE environment_id = ${seed.environmentId}
              AND event_type = 'chain.confirmed'
              AND payload->>'transactionHash' = ${receipt.transaction}
          ) AS confirmed
        `;
        return confirmed?.confirmed === true;
      });
      const [trace] = await sql<{ transaction_hash: string | null }[]>`
        SELECT transaction_hash FROM traces
        WHERE environment_id = ${seed.environmentId}
          AND transaction_hash = ${receipt.transaction}
        LIMIT 1
      `;
      expect(trace?.transaction_hash).toBe(receipt.transaction);
    } finally {
      await Promise.all([qusto.shutdown(), client.close(), server.close()]);
    }
  });
});
