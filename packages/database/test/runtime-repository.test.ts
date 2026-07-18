import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { migrateDatabase, PostgresRuntimeRepository } from "../src/index.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("PostgresRuntimeRepository", () => {
  let database: TestDatabase;
  let environmentId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
    const sql = postgres(database.url, { max: 1 });
    const [organization] = await sql<{ id: string }[]>`
      INSERT INTO organizations (name) VALUES ('Runtime') RETURNING id
    `;
    if (organization === undefined) throw new Error("organization seed failed");
    const [project] = await sql<{ id: string }[]>`
      INSERT INTO projects (organization_id, name, slug)
      VALUES (${organization.id}, 'API', 'api') RETURNING id
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
      VALUES (
        ${environment.id}, 1, 'published',
        '[{"id":"max","kind":"max-amount","maxAmountAtomic":"50","phases":["buyer"]}]'::jsonb
      ) RETURNING id
    `;
    if (policy === undefined) throw new Error("policy seed failed");
    await sql`
      UPDATE environments SET active_policy_version_id = ${policy.id}
      WHERE id = ${environment.id}
    `;
    await sql.end();
  });

  afterAll(async () => database.close());

  it("loads only the environment's active immutable policy", async () => {
    const repository = new PostgresRuntimeRepository(database.url);

    await expect(
      repository.getActivePolicy(environmentId)
    ).resolves.toMatchObject({
      rules: [expect.objectContaining({ id: "max" })]
    });
    await expect(
      repository.getActivePolicy("00000000-0000-0000-0000-000000000000")
    ).resolves.toBeUndefined();
    await repository.close();
  });

  it("reports database readiness", async () => {
    const repository = new PostgresRuntimeRepository(database.url);
    await expect(repository.isReady()).resolves.toBe(true);
    await repository.close();
  });
});
