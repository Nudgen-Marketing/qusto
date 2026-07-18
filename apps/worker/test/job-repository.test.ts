import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { migrateDatabase } from "@qusto/database";
import { PostgresJobRepository } from "../src/job-repository.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("PostgresJobRepository", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
  });

  afterAll(async () => database.close());

  it("claims each due job once across concurrent workers", async () => {
    const sql = postgres(database.url, { max: 1 });
    await sql`
      INSERT INTO jobs (type, payload) VALUES ('test', '{"value":1}'::jsonb)
    `;
    const first = new PostgresJobRepository(database.url);
    const second = new PostgresJobRepository(database.url);
    const claimed = await Promise.all([
      first.claim("worker-a", 1),
      second.claim("worker-b", 1)
    ]);

    expect(claimed.flat()).toHaveLength(1);
    await first.close();
    await second.close();
    await sql.end();
  });

  it("reschedules failures with bounded exponential backoff", async () => {
    const sql = postgres(database.url, { max: 1 });
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO jobs (type, payload) VALUES ('retry', '{}'::jsonb) RETURNING id
    `;
    if (created === undefined) throw new Error("job seed failed");
    const repository = new PostgresJobRepository(database.url);
    const [job] = await repository.claim("worker", 1);
    if (job === undefined) throw new Error("job claim failed");
    await repository.fail(job, new Error("temporary"));

    const [stored] = await sql<{ last_error: string; status: string }[]>`
      SELECT status, last_error FROM jobs WHERE id = ${created.id}
    `;
    expect(stored).toMatchObject({ status: "failed", last_error: "temporary" });
    await repository.close();
    await sql.end();
  });
});
