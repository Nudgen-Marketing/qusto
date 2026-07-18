import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { migrateDatabase } from "../src/index.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("database migrations", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
  });

  afterAll(async () => database.close());

  it("creates the full control-plane schema", async () => {
    const sql = postgres(database.url, { max: 1 });
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const names = rows.map(({ table_name }) => table_name);

    expect(names).toEqual(
      expect.arrayContaining([
        "api_keys",
        "audit_entries",
        "environments",
        "jobs",
        "policy_decisions",
        "policy_versions",
        "projects",
        "spend_ledger",
        "spend_reservations",
        "trace_events",
        "traces",
        "webhook_deliveries",
        "webhooks"
      ])
    );
    await sql.end();
  });

  it("creates trace_events as a partitioned table with a default partition", async () => {
    const sql = postgres(database.url, { max: 1 });
    const [table] = await sql<{ relkind: string }[]>`
      SELECT relkind FROM pg_class WHERE oid = 'trace_events'::regclass
    `;
    const partitions = await sql<{ child: string }[]>`
      SELECT child.relname AS child
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      WHERE parent.relname = 'trace_events'
    `;

    expect(table?.relkind).toBe("p");
    expect(partitions.map(({ child }) => child)).toContain(
      "trace_events_default"
    );
    await sql.end();
  });
});
