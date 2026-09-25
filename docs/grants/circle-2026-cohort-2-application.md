# Qusto — Circle 2026 Cohort 2 grant application

Prepared for: https://circle.questbook.app/proposal_form/?grantId=6992785dfb7e884efacadb1e&chainId=10

Status: Confirmed and populated in the live Questbook form. The video and deck URLs remain required before submission.

## Recommended grant position

- Requested funding: **25,000 USDC**
- Structure: **four milestone-based tranches**
- Delivery window: **September 1–December 31, 2026**
- License: **Apache-2.0**
- Primary program fit: **Agentic economic activity**
- Current Circle integration: **USDC on Base/Base Sepolia x402 flows**
- Planned Circle integrations: **USDC on Arc, Circle Agent Stack, and Circle Wallets**

The Questbook form does not expose a separate amount field. Use the recommended amount only if Circle asks for a budget during review or milestone design.

## Applicant details

**Primary contact first name**

> Toan

**Primary contact last name**

> Nhu

**Email address**

> toannhu.dev@gmail.com

**Company legal entity name**

> Nudgen LLC

**Company DBA name**

> Qusto

**Founder names, roles, bios**

> Toan Nhu — Founder and Lead Engineer. Toan is a data and platform engineer and the founder of Nudgen, with experience building distributed data systems, developer infrastructure, and production SaaS. He designed and built Qusto's TypeScript control plane, SDK, MCP payment client, dashboard, PostgreSQL data layer, and background worker.

**Project website**

> https://github.com/Nudgen-Marketing/qusto

**Project X handle**

> @nudgen_mkt

**Project GitHub URL**

> https://github.com/Nudgen-Marketing/qusto

**Founder location**

> Toan Nhu, Founder and Lead Engineer, Ho Chi Minh City, Vietnam

**Business country**

> United States

**Is the business incorporated?**

> Yes

## Project abstract

**Project name**

> Qusto

**One-line description (under 200 characters)**

> An open-source control plane that governs, traces, and audits autonomous USDC x402 payments before and after settlement.

**What problem are you solving and why is it important?**

> AI agents can now discover services and spend stablecoins at machine speed, but most teams lack an application-aware control layer between an agent's intent and settlement. A wallet limit alone cannot express which endpoint, tool, payee, asset, environment, or buyer/seller phase is allowed, and an onchain explorer cannot reconstruct the HTTP or MCP context that caused a payment. This creates excessive-spend, unauthorized-counterparty, debugging, and audit risks that slow production adoption of agentic commerce. Teams need deterministic pre-payment policy and complete evidence without handing a third party their keys.

**What is your solution to that problem?**

> Qusto is an Apache-2.0, self-hosted governance and observability control plane for x402 payments. Its SDK and MCP client evaluate deterministic buyer and seller policies before signing or verification, enforce rolling budgets with transactional reservations, and record an append-only lifecycle from HTTP 402 challenge through policy decision, settlement, and chain confirmation. Known transactions are reconciled onchain, operators receive signed webhooks, and every policy version and decision remains auditable. Wallet keys stay in the local application or MCP process. Qusto currently supports x402 v1/v2 and native USDC flows on Base/Base Sepolia; this grant will make Arc a first-class settlement network and add interoperability with Circle Agent Stack and Circle Wallets.

**Why hasn't this problem been solved yet? What barriers previously existed?**

> The underlying stack only recently converged. x402 v2 provides a more stable payment interface, Circle Agent Stack now gives agents wallets and machine-readable service discovery, and Arc is moving from public testnet toward mainnet. Governance also requires correlating offchain HTTP/MCP intent with onchain settlement without taking custody of keys. Explorers see transfers but not application intent; wallet controls do not capture endpoint- and phase-specific business policy; generic observability tools do not understand x402; and hosted payment controls can introduce a new custody or availability dependency. Qusto combines those layers in a self-hosted system while preserving local signing.

**Why are you and your team uniquely suited to solve this problem?**

> Toan's background spans data platforms, distributed systems, developer tooling, and production SaaS—the same disciplines required for reliable policy evaluation, high-volume event ingestion, reconciliation, and operator-grade observability. The public Qusto MVP already includes a Next.js API/dashboard, PostgreSQL repositories and migrations, a separate job worker, an SDK, an MCP payment client, x402 v1/v2 normalization, deterministic policy evaluation, signed webhooks, security controls, and a Base Sepolia USDC live-test harness. The repository contains 213 tracked files, roughly 11,500 TypeScript/JavaScript source lines, 46 test files, and 129 test cases. The latest retained local coverage artifact reports 89.09% line coverage and 82.69% branch coverage across the measured core modules. This is execution evidence, not a concept deck.

## Product alignment

**Currently live in production?**

> No. Qusto is a working open-source MVP and testnet integration, not yet a hosted production service.

**Live on Arc?**

> No

**Other chains currently live on**

> Base Sepolia testnet with native USDC; Base mainnet is supported by the self-hosted code path but no public production deployment is claimed.

**Circle products currently integrated**

> USDC

**Circle products planned**

> USDC; Agent Stack; Wallets

## Milestones and timelines

### Milestone 1 — Arc-native USDC x402 foundation

> **Target: September 30, 2026.** Add Arc public testnet and mainnet network definitions, USDC asset validation, RPC preflight checks, explorer links, finality-aware reconciliation, and Docker configuration. Deliver an automated end-to-end flow that inspects an x402 endpoint, evaluates policy, pays in USDC on Arc testnet, persists the lifecycle, and verifies the transaction independently. Acceptance evidence: public Apache-2.0 code, tests, setup documentation, and a reproducible Arc transaction walkthrough.

### Milestone 2 — Circle Agent Stack and Wallets interoperability

> **Target: October 31, 2026.** Add a Circle Agent Wallet-compatible signer/adapter and document how Circle wallet-level controls combine with Qusto's application-layer policies. Support global budgets, per-service caps, payee/asset/network allowlists, and time-bounded execution without transmitting wallet keys to Qusto. Deliver a Circle CLI/Agent Stack example in which a governed agent discovers a paid service and Qusto allows or denies the x402 request before settlement. Acceptance evidence: integration tests, example configuration, policy decision logs, and an end-to-end demo.

### Milestone 3 — Production-grade Arc governance and observability

> **Target: November 30, 2026.** Harden the full HTTP-to-Arc lifecycle for operators: idempotent telemetry, immutable policy/audit history, receipt reconciliation, signed webhook delivery, failure and denial diagnostics, retention controls, and load/security testing. Publish an operator runbook covering deployment, secrets, backup/restore, RPC health, and incident investigation. Acceptance evidence: documented load results, security review findings and remediations, failure-path tests, and a dashboard trace from 402 challenge to Arc confirmation.

### Milestone 4 — Public v1 release and ecosystem adoption

> **Target: December 31, 2026.** Publish the Arc-enabled `@qusto/sdk` and `@qusto/mcp` packages, a reference paid API/seller, integration guides, architecture documentation, and a five-minute technical walkthrough. Support at least three external developer teams or projects through integration and record at least 1,000 governed Arc testnet USDC payment attempts across allowed, denied, failed, and confirmed paths. Summarize feedback and publish the next roadmap. Acceptance evidence: tagged public release, package artifacts, public docs, anonymized aggregate metrics, and three integration references or written pilot confirmations.

## Traction and roadmap

**Current traction and success**

> Qusto is an early open-source MVP, so we do not claim production users, revenue, AUM, or mainnet volume. The public Apache-2.0 repository already ships a self-hosted dashboard/API, PostgreSQL storage and migrations, a background worker, SDK and MCP packages, deterministic buyer/seller policy, rolling spend reservations, immutable lifecycle events, Base reconciliation, signed webhooks, security controls, and an opt-in Base Sepolia live USDC x402 payment harness. Public implementation evidence includes 15 commits, 213 tracked files, about 11,500 TypeScript/JavaScript source lines, 46 test files, 129 test cases, a retained coverage report showing 89.09% line and 82.69% branch coverage across measured core modules, and recurring successful GitHub CodeQL scans. The grant converts this shipped foundation into an Arc- and Circle-native release with measurable external integrations.

**Public analytics dashboard**

> N/A — no production analytics dashboard yet. Milestone 4 includes anonymized aggregate adoption metrics.

**Are you funded?**

> No

**Technical roadmap**

> September 2026: implement Arc network, USDC validation, finality-aware reconciliation, and reproducible x402 E2E coverage. October: integrate Circle Agent Stack and Circle Wallets while preserving Qusto's local-key and self-hosted trust boundaries. November: harden telemetry, webhooks, operational controls, security, and load behavior for production pilots. December: publish the Arc-enabled v1 packages and reference seller, onboard three external teams, and reach 1,000 governed Arc testnet payment attempts. Each milestone is independently verifiable in the public repository and advances Arc from an optional network to Qusto's primary Circle settlement target.

**How will the grant support the roadmap?**

> We recommend a 25,000 USDC grant in four milestone-based tranches. Funding will cover focused Arc and Agent Stack engineering, automated USDC integration infrastructure, an independent security review, documentation and reference examples, and hands-on pilot support. Proposed allocation: 14,000 USDC for engineering and tests; 5,000 USDC for external security review and remediation; 3,000 USDC for reproducible infrastructure and testnet operations; and 3,000 USDC for documentation, technical video, and developer onboarding. All funded software and documentation will remain Apache-2.0; no token incentives or proprietary grant-only modules are proposed.

## Deck and demo

**Technical video URL**

> REQUIRED: provide a public or unlisted URL to a video no longer than five minutes.

Recommended structure:

1. Problem and architecture — 30 seconds.
2. Codebase walkthrough of USDC/x402 normalization, policy evaluation, and local signing — 90 seconds.
3. Live Base Sepolia payment: inspect, governed fetch, allow/deny, chain confirmation — 120 seconds.
4. Arc + Circle Agent Stack integration plan and milestones — 45 seconds.
5. Open-source ask and ecosystem impact — 15 seconds.

**Investor/grant deck URL**

> REQUIRED: provide a public or shareable URL.

## Conflict of interest

**Conflict of interest**

> No

## Submission checklist

- [x] Confirm contact email.
- [x] Confirm business country.
- [x] Confirm incorporation status and legal entity.
- [x] Confirm project X handle.
- [x] Confirm production and funding status.
- [x] Confirm conflict-of-interest response.
- [ ] Supply the technical video URL.
- [ ] Supply the deck URL.
- [x] Approve transmission of the application to Circle/Questbook.
- [ ] Review the final browser form immediately before submission.
