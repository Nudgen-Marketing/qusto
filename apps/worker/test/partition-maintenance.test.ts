import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { migrateDatabase } from "@qusto/database";
import { PostgresMaintenance } from "../src/maintenance.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("partition maintenance", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
  });

  afterAll(async () => database.close());

  it("creates upcoming daily partitions and drops expired partitions", async () => {
    const maintenance = new PostgresMaintenance(database.url);
    await maintenance.ensureTracePartitions(
      new Date("2030-01-10T00:00:00.000Z"),
      2
    );
    const sql = postgres(database.url, { max: 1 });
    const before = await sql<{ relname: string }[]>`
      SELECT child.relname
      FROM pg_inherits
      JOIN pg_class child ON child.oid = inhrelid
      JOIN pg_class parent ON parent.oid = inhparent
      WHERE parent.relname = 'trace_events'
    `;
    expect(before.map(({ relname }) => relname)).toContain(
      "trace_events_20300110"
    );

    await maintenance.dropExpiredTracePartitions(
      new Date("2030-01-12T00:00:00.000Z"),
      1
    );
    const after = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('trace_events_20300110') IS NOT NULL AS exists
    `;
    expect(after[0]?.exists).toBe(false);
    await maintenance.close();
    await sql.end();
  });
});
