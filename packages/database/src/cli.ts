import { migrateDatabase } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

await migrateDatabase(databaseUrl);
console.info(JSON.stringify({ level: "info", message: "database.migrated" }));
