import { randomUUID } from "node:crypto";

import postgres from "postgres";

export interface TestDatabase {
  readonly url: string;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = process.env.POSTGRES_TEST_URL ?? "postgresql://localhost/postgres";
  const databaseName = `qusto_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(adminUrl, { max: 1 });

  await admin.unsafe(`CREATE DATABASE ${databaseName}`);
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;

  return {
    url: url.toString(),
    async close() {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await admin.end();
    }
  };
}
