import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import {
  authorizeRegistration,
  completeRegistration,
  hashInvitationToken
} from "@qusto/control-plane";
import {
  migrateDatabase,
  PostgresRegistrationRepository
} from "../src/index.js";
import { createTestDatabase } from "./helpers.js";
import type { TestDatabase } from "./helpers.js";

describe("PostgresRegistrationRepository", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
  });

  afterAll(async () => database.close());

  it("bootstraps one organization with three isolated environments", async () => {
    const sql = postgres(database.url, { max: 1 });
    const repository = new PostgresRegistrationRepository(database.url);
    const authorization = await authorizeRegistration(
      "admin@example.com",
      undefined,
      repository
    );
    await sql`
      INSERT INTO users (id, name, email)
      VALUES ('admin', 'Admin', 'admin@example.com')
    `;
    await completeRegistration(
      authorization,
      { email: "admin@example.com", id: "admin" },
      repository
    );

    const environments = await sql<
      { active_policy_version_id: string; fail_mode: string; name: string }[]
    >`
      SELECT name, fail_mode, active_policy_version_id FROM environments ORDER BY name
    `;
    const [membership] = await sql<{ role: string }[]>`
      SELECT role FROM memberships WHERE user_id = 'admin'
    `;
    expect(environments.map(({ name }) => name).sort()).toEqual([
      "development",
      "production",
      "staging"
    ]);
    expect(
      environments.every(
        ({ active_policy_version_id }) => active_policy_version_id.length > 0
      )
    ).toBe(true);
    expect(membership?.role).toBe("admin");
    await repository.close();
    await sql.end();
  });

  it("accepts a matching one-time invitation", async () => {
    const sql = postgres(database.url, { max: 1 });
    await sql`
      INSERT INTO users (id, name, email)
      VALUES ('developer', 'Developer', 'dev@example.com')
    `;
    const [organization] = await sql<{ id: string }[]>`
      SELECT id FROM organizations LIMIT 1
    `;
    if (organization === undefined) throw new Error("organization missing");
    const invitationFixture = ["invitation", "x".repeat(32)].join("-");
    await sql`
      INSERT INTO invitations (organization_id, email, role, token_hash, expires_at)
      VALUES (
        ${organization.id}, 'dev@example.com', 'developer',
        ${hashInvitationToken(invitationFixture)}, now() + interval '1 hour'
      )
    `;
    const repository = new PostgresRegistrationRepository(database.url);
    const authorization = await authorizeRegistration(
      "dev@example.com",
      invitationFixture,
      repository
    );
    await completeRegistration(
      authorization,
      { email: "dev@example.com", id: "developer" },
      repository
    );

    const [membership] = await sql<{ role: string }[]>`
      SELECT role FROM memberships WHERE user_id = 'developer'
    `;
    const [invitation] = await sql<{ accepted_by: string }[]>`
      SELECT accepted_by FROM invitations WHERE email = 'dev@example.com'
    `;
    expect(membership?.role).toBe("developer");
    expect(invitation?.accepted_by).toBe("developer");
    await repository.close();
    await sql.end();
  });
});
