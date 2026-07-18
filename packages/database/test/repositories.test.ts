import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { evaluatePayment, ingestEvents } from "@qusto/control-plane";
import {
  migrateDatabase,
  PostgresEvaluationRepository,
  PostgresEventRepository
} from "../src/index.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";
import type { PolicyEvaluationInput, TraceEvent } from "@qusto/control-plane";
import type { PolicyRule } from "@qusto/policy-engine";

describe("PostgreSQL repositories", () => {
  let database: TestDatabase;
  let environmentId: string;
  let policyVersionId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
    const sql = postgres(database.url, { max: 1 });
    const [organization] = await sql<{ id: string }[]>`
      INSERT INTO organizations (name) VALUES ('Qusto Test') RETURNING id
    `;
    const [project] = await sql<{ id: string }[]>`
      INSERT INTO projects (organization_id, name, slug)
      VALUES (${organization!.id}, 'Payments', 'payments') RETURNING id
    `;
    const [environment] = await sql<{ id: string }[]>`
      INSERT INTO environments (project_id, name, fail_mode)
      VALUES (${project!.id}, 'production', 'closed') RETURNING id
    `;
    const [policyVersion] = await sql<{ id: string }[]>`
      INSERT INTO policy_versions (environment_id, version, status, rules)
      VALUES (${environment!.id}, 1, 'published', '[]'::jsonb) RETURNING id
    `;
    environmentId = environment!.id;
    policyVersionId = policyVersion!.id;
    await sql.end();
  });

  afterAll(async () => database.close());

  it("serializes concurrent budget decisions so the limit cannot be overspent", async () => {
    const repository = new PostgresEvaluationRepository(database.url);
    const baseInput: PolicyEvaluationInput = {
      amountAtomic: "12500000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      environmentId,
      idempotencyKey: "pay_concurrent_000000000001",
      network: "eip155:8453",
      payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      phase: "buyer",
      policyVersionId,
      resourceUrl: "https://api.example.com/v1/data",
      traceId: "trace_concurrent_000000001"
    };
    const rules: PolicyRule[] = [
      {
        id: "daily-budget",
        kind: "rolling-limit",
        maxAmountAtomic: "20000000",
        phases: ["buyer"],
        windowSeconds: 86_400
      }
    ];

    const decisions = await Promise.all([
      evaluatePayment(baseInput, rules, repository),
      evaluatePayment(
        {
          ...baseInput,
          idempotencyKey: "pay_concurrent_000000000002",
          traceId: "trace_concurrent_000000002"
        },
        rules,
        repository
      )
    ]);

    expect(decisions.map(({ outcome }) => outcome).sort()).toEqual(["allow", "deny"]);
    await repository.close();
  });

  it("inserts immutable events idempotently and updates the trace projection", async () => {
    const repository = new PostgresEventRepository(database.url);
    const event: TraceEvent = {
      environmentId,
      eventId: "event_database_000000000001",
      occurredAt: "2026-07-18T04:00:00.000Z",
      payload: { amountAtomic: "12500000", status: "required" },
      traceId: "trace_database_000000000001",
      type: "payment.required"
    };

    expect(await ingestEvents([event], repository)).toMatchObject({ accepted: [event.eventId] });
    expect(await ingestEvents([event], repository)).toMatchObject({ duplicates: [event.eventId] });

    const sql = postgres(database.url, { max: 1 });
    const [trace] = await sql<{ last_event_type: string }[]>`
      SELECT last_event_type FROM traces WHERE id = ${event.traceId}
    `;
    expect(trace?.last_event_type).toBe("payment.required");
    await sql.end();
    await repository.close();
  });
});
