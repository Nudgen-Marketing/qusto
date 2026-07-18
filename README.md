# Qusto

Qusto is a self-hosted governance and observability control plane for instrumented x402 payments. It evaluates deterministic buyer/seller policy before funds move, traces the full HTTP-to-chain lifecycle, reconciles known Base transactions, and keeps the operator in control of keys, policy versions, webhooks, and retention.

## Quick start

Requirements: Docker Engine with Compose v2 and a Base JSON-RPC URL.

```bash
cp .env.example .env
# Replace every placeholder in .env, then:
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000`. The first account bootstraps the deployment and becomes Admin. Public registration then closes; invite links are generated under **Team**.

The Compose deployment contains PostgreSQL 17, a one-shot migrator, the web/API service, and the background worker. No Redis, ClickHouse, object store, or hosted dependency is required.

## Instrument an application

```bash
pnpm add @qusto/sdk
```

```ts
import { createQusto } from "@qusto/sdk";

const qusto = createQusto({
  apiKey: process.env.QUSTO_API_KEY!,
  baseUrl: "https://qusto.example.com",
  environment: "production"
});

const governedFetch = qusto.createGovernedFetch({ signer });
const response = await governedFetch("https://paid.example.com/data");
await qusto.shutdown();
```

Qusto accepts x402 v1 and v2 requirements and emits v2 for new flows. The SDK never creates, transmits, or stores wallet private keys.

## Install the MCP payment client

```json
{
  "mcpServers": {
    "qusto": {
      "command": "npx",
      "args": ["-y", "@qusto/mcp"],
      "env": {
        "QUSTO_BASE_URL": "https://qusto.example.com",
        "QUSTO_API_KEY": "qsk_...",
        "X402_PRIVATE_KEY": "0x...",
        "BASE_RPC_URL": "https://your-base-rpc.example"
      }
    }
  }
}
```

The MCP server exposes only `governed_fetch`, `inspect_x402_endpoint`, `discover_x402`, and `wallet_info`. It blocks unsafe protocols, embedded credentials, private/link-local destinations, DNS rebinding, excessive redirects, oversized responses, and timeouts. The wallet key remains in the local MCP process.

## Development

```bash
corepack enable
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

PostgreSQL integration tests use a local `postgresql://localhost/postgres` database by default and isolate their own schemas. Set `TEST_DATABASE_URL` to override it.

See [Operations](docs/operations.md), [Architecture](docs/architecture.md), and the [v1 implementation plan](docs/qusto-v1-plan.md).

## License

Apache-2.0.
