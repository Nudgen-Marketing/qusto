# Self-hosted operations

## Production deployment

Use a dedicated VM or container host with Docker Compose v2. For the documented 100 events/second profile, start with 4 vCPU, 8 GB RAM, and monitored SSD storage. At continuous peak traffic, 90 days can approach 778 million events; size storage from measured event/index bytes and reduce retention when necessary.

Generate independent random values for `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, and `QUSTO_ENCRYPTION_KEY`. Back up the encryption key separately from the database; losing it makes webhook secrets unrecoverable. Wallet private keys do not belong on the Qusto server.

Terminate TLS at Caddy, nginx, Traefik, or a load balancer. Forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`; set `QUSTO_PUBLIC_URL` to the public HTTPS origin. Do not expose PostgreSQL. Restrict dashboard ingress and rate-limit public API routes at the proxy in addition to application limits.

```bash
docker compose pull
docker compose build --pull
docker compose up -d
curl --fail https://qusto.example.com/api/health/live
curl --fail https://qusto.example.com/api/health/ready
```

`live` proves the web process is responding. `ready` proves PostgreSQL is reachable. The dashboard also reports the worker heartbeat; investigate a stale heartbeat or a growing `jobs` backlog.

## Backups and restore drills

Take encrypted daily logical backups and provider-level volume snapshots. Keep at least one copy outside the deployment host.

```bash
docker compose exec -T postgres pg_dump -U qusto -d qusto -Fc > qusto.dump
docker compose exec -T postgres pg_dumpall -U qusto --globals-only > globals.sql
```

Test restores on an isolated network at least monthly:

```bash
createdb qusto_restore
pg_restore --clean --if-exists --no-owner -d qusto_restore qusto.dump
psql qusto_restore -c 'select count(*) from _qusto_migrations;'
```

Verify recent traces, active policy references, API-key rows, pending jobs, and audit entries. Never point a restore drill worker at production webhooks or RPC automation.

## Upgrades and rollback

Back up first, read release notes, and build the exact release tag. Migrations are ordered, transactional, and recorded in `_qusto_migrations`.

```bash
docker compose build --pull
docker compose run --rm migrate
docker compose up -d web worker
docker compose ps
```

Application rollback is safe only when the older release understands the migrated schema. Database migrations are forward-only; restore the pre-upgrade backup for an incompatible schema rollback.

## Retention, RPC, and incidents

Trace retention defaults to 90 days and audit/policy-decision retention to 365 days. The worker pre-creates daily partitions and drops expired trace partitions. Shared partitions use the longest configured environment retention to prevent one environment from deleting another's data.

Use a reliable Base RPC provider with receipt and `finalized` block support. Qusto does not scan the chain globally; it reconciles only transaction hashes observed through instrumented flows. If RPC is unavailable, policy decisions continue, while reconciliation jobs retry.

During an incident, preserve logs and audit entries, rotate affected API/webhook/auth secrets, disable compromised webhooks, and revoke project API keys from Settings. A leaked encryption key requires generating a new key and recreating all webhook secrets.
