import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import {
  completeReservation,
  createApiKey,
  createDraft,
  publishDraft,
  releaseReservation
} from "@qusto/control-plane";
import {
  migrateDatabase,
  PostgresApiKeyRepository,
  PostgresPolicyAdminRepository,
  PostgresReservationRepository
} from "../src/index.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("PostgreSQL control-plane repositories", () => {
  let database: TestDatabase;
  let environmentId: string;
  let organizationId: string;
  let policyVersionId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
    const sql = postgres(database.url, { max: 1 });
    const [organization] = await sql<{ id: string }[]>`
      INSERT INTO organizations (name) VALUES ('Qusto Test') RETURNING id
    `;
    if (organization === undefined) throw new Error("organization seed failed");
    organizationId = organization.id;
    const [project] = await sql<{ id: string }[]>`
      INSERT INTO projects (organization_id, name, slug)
      VALUES (${organization.id}, 'Payments', 'payments') RETURNING id
    `;
    if (project === undefined) throw new Error("project seed failed");
    const [environment] = await sql<{ id: string }[]>`
      INSERT INTO environments (project_id, name, fail_mode)
      VALUES (${project.id}, 'production', 'closed') RETURNING id
    `;
    if (environment === undefined) throw new Error("environment seed failed");
    environmentId = environment.id;
    const [policy] = await sql<{ id: string }[]>`
      INSERT INTO policy_versions (environment_id, version, status, rules)
      VALUES (${environment.id}, 1, 'published', '[]'::jsonb) RETURNING id
    `;
    if (policy === undefined) throw new Error("policy seed failed");
    policyVersionId = policy.id;
    await sql.end();
  });

  afterAll(async () => database.close());

  it("authenticates a valid non-revoked key without storing its secret", async () => {
    const generated = createApiKey();
    const sql = postgres(database.url, { max: 1 });
    await sql`
      INSERT INTO api_keys (environment_id, name, lookup, secret_hash)
      VALUES (${environmentId}, 'SDK', ${generated.lookup}, ${generated.secretHash})
    `;
    const repository = new PostgresApiKeyRepository(database.url);

    await expect(repository.authenticate(generated.token)).resolves.toEqual({
      environmentId
    });
    await expect(
      repository.authenticate(`${generated.token}x`)
    ).resolves.toBeUndefined();
    const [stored] = await sql<{ secret_hash: string }[]>`
      SELECT secret_hash FROM api_keys WHERE lookup = ${generated.lookup}
    `;
    expect(stored?.secret_hash).not.toContain(generated.token);
    await repository.close();
    await sql.end();
  });

  it("publishes and rolls policy versions with an audit trail", async () => {
    const repository = new PostgresPolicyAdminRepository(
      database.url,
      environmentId
    );
    const draft = await createDraft(
      environmentId,
      [
        {
          id: "max",
          kind: "max-amount",
          maxAmountAtomic: "100",
          phases: ["buyer"]
        }
      ],
      "bootstrap-admin",
      repository
    );
    const published = await publishDraft(
      draft.id,
      "bootstrap-admin",
      repository
    );

    expect(published.status).toBe("published");
    const sql = postgres(database.url, { max: 1 });
    const [environment] = await sql<{ active_policy_version_id: string }[]>`
      SELECT active_policy_version_id FROM environments WHERE id = ${environmentId}
    `;
    const audits = await sql<{ action: string; organization_id: string }[]>`
      SELECT action, organization_id FROM audit_entries ORDER BY occurred_at
    `;
    expect(environment?.active_policy_version_id).toBe(published.id);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "policy.published",
          organization_id: organizationId
        })
      ])
    );
    await sql.end();
    await repository.close();
  });

  it("completes and releases reservations idempotently", async () => {
    const sql = postgres(database.url, { max: 1 });
    await sql`
      INSERT INTO policy_decisions (
        id, environment_id, policy_version_id, trace_id, idempotency_key,
        outcome, payer, payee, asset, amount_atomic
      ) VALUES (
        'dec-complete', ${environmentId}, ${policyVersionId}, 'trace-complete',
        'reservation_complete_000001', 'allow', '0xpayer', '0xpayee', '0xasset', 25
      ), (
        'dec-release', ${environmentId}, ${policyVersionId}, 'trace-release',
        'reservation_release_0000001', 'allow', '0xpayer', '0xpayee', '0xasset', 10
      )
    `;
    await sql`
      INSERT INTO spend_reservations (
        id, environment_id, decision_id, payer, asset, amount_atomic, expires_at
      ) VALUES
        ('res-complete', ${environmentId}, 'dec-complete', '0xpayer', '0xasset', 25, now() + interval '1 minute'),
        ('res-release', ${environmentId}, 'dec-release', '0xpayer', '0xasset', 10, now() + interval '1 minute')
    `;
    const repository = new PostgresReservationRepository(database.url);
    await completeReservation(
      environmentId,
      "res-complete",
      { settledAt: new Date().toISOString(), transactionHash: "0xabc" },
      repository
    );
    await completeReservation(
      environmentId,
      "res-complete",
      { settledAt: new Date().toISOString(), transactionHash: "0xabc" },
      repository
    );
    await releaseReservation(environmentId, "res-release", repository);

    const [ledger] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM spend_ledger WHERE reservation_id = 'res-complete'
    `;
    expect(ledger?.count).toBe("1");
    await repository.close();
    await sql.end();
  });
});
