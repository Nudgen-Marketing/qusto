# Qusto v1 — Self-Hosted x402 Governance and Observability

## Summary

Build an Apache-2.0 TypeScript platform that governs and traces Base USDC x402 payments. Users install either `@qusto/mcp` for agent-driven paid HTTP requests or `@qusto/sdk` for buyer/seller applications. A Docker Compose deployment runs the dashboard/API, background worker, and PostgreSQL.

V1 provides deterministic allow/deny policies, immutable audit history, lifecycle traces, on-chain reconciliation, signed webhooks, and team/project management. Complexity: **Large**.

Implementation remains gated on explicit approval of this plan.

## Architecture and Implementation

### Platform foundation

- Create a strict TypeScript pnpm/Turborepo with:
  - Next.js dashboard and REST API.
  - Separate Node.js worker.
  - `@qusto/sdk`, `@qusto/mcp`, shared schemas, database, policy-engine, and UI packages.
  - Drizzle ORM with SQL migrations, Vitest, Playwright, structured JSON logging, linting, type checks, and coverage enforcement.
- Use Better Auth with PostgreSQL sessions and local email/password accounts. Disable public registration after bootstrap; admins generate one-time invitation links.
- Support one organization per deployment, multiple projects, and fixed `Admin`, `Developer`, and `Viewer` roles.
- Each project has isolated dev/staging/prod environments and independently revocable secret API keys.
- Supply multi-architecture Docker images and Compose services for `web`, `worker`, `migrate`, and PostgreSQL 17. Redis, ClickHouse, object storage, and hosted dependencies are excluded.

### Storage and processing

- Store:
  - Organizations, users, memberships, projects, environments, and hashed API keys.
  - Payment trace projections and immutable lifecycle events.
  - Draft and immutable published policy versions.
  - Policy decisions, spend reservations, settled-spend ledger entries, webhooks, delivery attempts, audit entries, and background jobs.
- Partition immutable trace events by day and index by environment/time, trace ID, payment identifier, transaction hash, payer, payee, and status.
- Keep a compact trace projection for dashboard queries rather than rebuilding traces from event rows.
- Use a PostgreSQL outbox/job queue with `FOR UPDATE SKIP LOCKED` for webhooks, reconciliation, rollups, partition maintenance, and retention.
- Default trace retention to 90 days and audit/policy-decision retention to 365 days; make both configurable. Retention drops expired partitions instead of row-by-row deletion.
- Preserve metadata by default. Strip credentials and sensitive query parameters, never collect private keys or authorization headers, and store request/response payloads only through explicit field allowlists, redaction rules, and a 32 KB limit.

### Trace lifecycle

- Normalize x402 v1 and v2 into one internal schema while emitting v2 for new payment flows.
- Represent one payment attempt as a trace with events such as:
  - Payment required.
  - Policy allowed, denied, or unavailable.
  - Payment payload created.
  - Verification succeeded or failed.
  - Settlement submitted, succeeded, or failed.
  - Chain receipt confirmed, reverted, or finalized.
- Generate an internal trace ID before policy evaluation. Use the standard x402 payment-identifier extension when the resource advertises it; otherwise correlate buyer/seller observations through payment fingerprints and the final transaction hash.
- Deduplicate events by event ID and policy calls by idempotency key.
- Reconcile only Qusto-known Base transactions through an operator-supplied RPC URL. Record receipt success after inclusion and finalization when the Base `finalized` block advances past the receipt block.
- Do not build a global public explorer or classify unrelated on-chain transfers as x402 activity.

### Governance engine

- Scope each policy set to a project environment and either the buyer, seller, or both integration phases.
- Provide these v1 rule types:
  - Maximum amount per payment.
  - Rolling spend limit with 1-hour, 24-hour, 7-day, or 30-day windows.
  - Payer, payee, endpoint/tool, asset, and network allowlists.
  - Matching denylists for the same dimensions.
- Use conjunctive match filters without a generic nested expression language. Any applicable deny or limit violation wins; otherwise the environment defaults to allow.
- Evaluate buyer policies synchronously before signing and seller policies before verification/execution.
- Enforce rolling budgets transactionally using per-scope PostgreSQL advisory locks and expiring reservations. Convert a reservation to settled spend after confirmation; release it on failure or expiry.
- Save policy changes as drafts. Publishing creates an immutable version and atomically activates it; rollback reactivates a prior immutable version and creates a new audit entry.
- Cache immutable policy definitions in the web service, while budget checks remain transactional.
- Default SDK outage behavior:
  - Development: allow and queue an unavailable-decision event.
  - Staging/production: deny.
  - Permit an explicit per-environment override.
  - Default synchronous evaluation timeout: 500 ms, configurable up to 5 seconds.

### SDK and MCP package

- `@qusto/sdk` will expose:
  - `createQusto(config)`.
  - Buyer instrumentation for official x402 client/payment-creation hooks.
  - Seller instrumentation for official resource-server verification and settlement hooks.
  - `createGovernedFetch({ signer, ... })` for HTTP x402 flows.
  - `flush()` and `shutdown()` for buffered telemetry.
- Accept an x402-compatible EVM signer from application code. The SDK never creates, transmits, or stores private keys.
- `@qusto/mcp` will run over stdio and require `QUSTO_BASE_URL`, `QUSTO_API_KEY`, and a locally supplied `X402_PRIVATE_KEY`.
- MCP tools:
  - Governed `fetch` for HTTP x402 endpoints.
  - Endpoint schema/pricing inspection.
  - `.well-known/x402` discovery.
  - Wallet address and Base USDC balance.
- The MCP package will not expose policy administration or trace-query tools.
- Protect the agent-facing fetch surface with protocol validation, bounded redirects, DNS rebinding checks, private/link-local address blocking outside explicit development mode, response-size limits, and request timeouts.
- Native paid MCP-to-MCP transport is deferred; v1 follows x402scan’s MCP-as-HTTP-payment-client model. [x402scan reference](https://github.com/Merit-Systems/x402scan)

### Dashboard and operations

- Build:
  - Bootstrap/onboarding and copyable SDK/MCP installation instructions.
  - Overview metrics for spend, payments, denies, failures, latency, and worker health.
  - Filterable trace list with a lifecycle timeline and Base explorer links.
  - Policy editor, recent-trace simulator, diff, publish, and rollback.
  - Project/environment/API-key management.
  - Team invitations and RBAC.
  - Webhook configuration, delivery history, retry controls, and audit log.
- Stream new trace and decision updates to the dashboard through authenticated server-sent events.
- Emit signed webhooks for `policy.denied`, `settlement.failed`, `chain.reverted`, and optional `spend.threshold_reached`.
- Sign deliveries with timestamped HMAC-SHA256 headers, retry with exponential backoff, and prevent replay through delivery IDs and timestamp validation.
- Document secrets, TLS/reverse-proxy setup, backups, restore testing, upgrades, retention sizing, RPC configuration, and health endpoints.

## Public APIs and Types

- `POST /api/public/v1/policy/evaluate`
  - Accepts idempotency key, phase, trace context, protocol version, scheme, CAIP-2 network, asset, atomic amount, payer, payee, resource/tool identity, and SDK metadata.
  - Returns decision ID, `allow | deny`, stable reason codes, policy version, optional spend reservation, and expiry.
- `POST /api/public/v1/events/batch`
  - Accepts up to 100 immutable, schema-versioned trace events.
  - Returns accepted, duplicate, and rejected event IDs.
- `POST /api/public/v1/reservations/{id}/complete|release`
  - Idempotently finalizes or releases buyer spend reservations.
- API responses use `{ ok, data, meta? }` or `{ ok: false, error: { code, message, details?, requestId } }`.
- Project API keys use a lookup prefix plus a high-entropy secret, are displayed once, and are stored only as hashes.
- All monetary values cross APIs as atomic-unit decimal strings; addresses are checksummed internally and compared canonically.
- Webhook payloads are versioned and contain metadata only by default.

## Test and Acceptance Plan

- Follow TDD and require at least 80% line and branch coverage for the SDK, policy engine, API, and worker.
- Unit-test:
  - x402 v1/v2 normalization.
  - Big-int monetary handling.
  - Policy matching and deny precedence.
  - Rolling-window limits and reservation expiry.
  - Fail-open/fail-closed behavior.
  - Redaction, URL sanitization, webhook signatures, and event deduplication.
- Integration-test:
  - PostgreSQL migrations and partition routing.
  - Concurrent budget evaluations proving limits cannot be overspent.
  - API-key and project isolation.
  - Draft/publish/rollback behavior.
  - Job claiming, webhook retries, retention, and Base RPC reconciliation.
- Contract-test buyer and seller hooks against the official x402 packages using Base/Base Sepolia fixtures.
- Test the MCP server through stdio JSON-RPC, including allowed, denied, insufficient-balance, malformed-402, redirect, timeout, and settlement-failure flows.
- Playwright-test bootstrap, invitation, project/key creation, policy publication, denied and allowed payment traces, rollback, and webhook inspection.
- Load-test 100 telemetry events/second for 30 minutes on a documented 4-vCPU/8-GB reference host:
  - No accepted-event loss or duplicates.
  - Policy evaluation p95 below 100 ms excluding network latency.
  - Batch-ingestion p95 below 200 ms.
  - Worker backlog returns to zero after the run.
- Run lint, formatting checks, type checks, unit/integration/E2E suites, container smoke tests, dependency audit, and secret scanning in CI.

## Risks and Assumptions

- The repository is currently empty, so there are no local naming, error, logging, data-access, or test conventions to mirror. The implementation will establish kebab-case files/packages, camelCase functions, PascalCase types, structured errors/logs, repository-style data access, and co-located Vitest tests.
- At 100 events/second, 90 days represents approximately 778 million events. PostgreSQL-only operation therefore requires daily partitions, aggressive projection use, capacity monitoring, and potentially 1 TB or more of SSD storage depending on event and index size. A future analytics-store migration remains possible but is outside v1.
- “All transactions” means all instrumented payments, not all Base activity. Chain data alone cannot recover HTTP/MCP context.
- Human approval/hold workflows, managed wallets, a hosted SaaS, global explorer, native paid MCP transport, multi-organization tenancy, OIDC/SSO, facilitator hosting, non-Base chains, Python/Go SDKs, and generic policy expressions are explicitly deferred.
- The design follows Prefactor’s observe/evaluate/enforce control-plane model, the official x402 lifecycle hooks and payment-identifier extension, x402scan’s installable MCP payment-client experience, and Langfuse’s self-hosted operational approach: [Prefactor](https://prefactor.tech/), [x402 specification](https://github.com/coinbase/x402/tree/main/specs), [Langfuse self-hosting reference](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml).
- PostgreSQL declarative partitioning is the selected high-volume retention mechanism. [PostgreSQL documentation](https://www.postgresql.org/docs/17/ddl-partitioning.html)
