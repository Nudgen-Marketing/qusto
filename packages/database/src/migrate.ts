import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const migrationsDirectory = fileURLToPath(
  new URL("../migrations", import.meta.url)
);

export async function migrateDatabase(url: string): Promise<void> {
  const sql = postgres(url, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _qusto_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM _qusto_migrations WHERE name = ${file}) AS exists
      `;
      if (existing[0]?.exists === true) continue;

      await sql.begin(async (transaction) => {
        await transaction.file(`${migrationsDirectory}/${file}`);
        await transaction`INSERT INTO _qusto_migrations (name) VALUES (${file})`;
      });
    }
  } finally {
    await sql.end();
  }
}
