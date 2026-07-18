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

`BASE_NETWORK` accepts `base` (the default) or `base-sepolia`. Qusto validates that the configured RPC reports the matching chain ID before the worker starts.

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
        "BASE_NETWORK": "base",
        "BASE_RPC_URL": "https://your-base-rpc.example"
      }
    }
  }
}
```

The MCP server exposes only `governed_fetch`, `inspect_x402_endpoint`, `discover_x402`, and `wallet_info`. It blocks unsafe protocols, embedded credentials, private/link-local destinations, DNS rebinding, excessive redirects, oversized responses, and timeouts. The wallet key remains in the local MCP process.

## Base Sepolia live E2E

The opt-in profile starts a local `$0.001` x402 seller and makes one governed payment with Base Sepolia test USDC. It is separate from `pnpm test:e2e`, which remains deterministic and does not use a wallet.

```bash
cp .env.sepolia.example .env.sepolia
mkdir -p .secrets
install -m 600 /dev/null .secrets/base-sepolia-private-key
# Put one dedicated 0x-prefixed testnet private key in that file.
# Set SEPOLIA_E2E_PAY_TO in .env.sepolia to a testnet recipient.
```

Fund the buyer address with Base Sepolia USDC, then run:

```bash
docker compose --env-file .env --env-file .env.sepolia \
  --profile sepolia-e2e up --build -d postgres migrate web worker seller
docker compose --env-file .env --env-file .env.sepolia \
  --profile sepolia-e2e run --rm sepolia-e2e
docker compose --env-file .env --env-file .env.sepolia \
  --profile sepolia-e2e down
```

The runner refuses to sign unless the RPC, x402 challenge, token, recipient, amount, wallet balance, web readiness, and worker heartbeat all match its Base Sepolia configuration. Success requires Qusto to persist the transaction and emit `chain.confirmed`. Set `SEPOLIA_E2E_KEEP_DATA=true` to retain the seeded Qusto records for inspection.

### Manual Base Sepolia flow

Use a dedicated test-only wallet. Fund it with Base Sepolia ETH from a [Base-listed faucet](https://docs.base.org/base-chain/tools/network-faucets) and Base Sepolia USDC from the [Circle faucet](https://faucet.circle.com/). Testnet tokens have no financial value, but the private key should still never be reused or committed.

1. Start Qusto with `.env.sepolia` loaded after `.env`, and keep the optional seller running with `docker compose --env-file .env --env-file .env.sepolia --profile sepolia-e2e up --build -d postgres migrate web worker seller`.
2. Open the dashboard, create a development environment API key, and publish a buyer `max-amount` policy with `maxAmountAtomic` set to `1000`.
3. Configure the local MCP server with `QUSTO_BASE_URL=http://localhost:3000`, the development API key, `BASE_NETWORK=base-sepolia`, `BASE_RPC_URL=https://sepolia.base.org`, `X402_PRIVATE_KEY_FILE` set to the absolute secret-file path, `QUSTO_ENVIRONMENT=development`, and `QUSTO_MCP_ALLOW_PRIVATE=true`.
4. Call `inspect_x402_endpoint` for `http://localhost:4021/weather`. Verify `eip155:84532`, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, the intended recipient, and amount `1000` before calling `governed_fetch` for the same URL.
5. Open Traces in Qusto and wait for `settlement.submitted`, `settlement.succeeded`, and `chain.confirmed`. Open the stored transaction hash at `https://sepolia.basescan.org/tx/<transaction-hash>` to verify it independently.

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
