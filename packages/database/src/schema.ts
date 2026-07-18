import { drizzle } from "drizzle-orm/postgres-js";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import postgres from "postgres";

export const organizations = pgTable("organizations", {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  singleton: boolean("singleton").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").notNull(),
  slug: text("slug").notNull()
});

export const environments = pgTable("environments", {
  activePolicyVersionId: uuid("active_policy_version_id"),
  auditRetentionDays: integer("audit_retention_days").notNull(),
  failMode: text("fail_mode").notNull(),
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  projectId: uuid("project_id").notNull(),
  traceRetentionDays: integer("trace_retention_days").notNull()
});

export const policyVersions = pgTable("policy_versions", {
  environmentId: uuid("environment_id").notNull(),
  id: uuid("id").primaryKey(),
  rules: jsonb("rules").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull()
});

export const traces = pgTable("traces", {
  environmentId: uuid("environment_id").notNull(),
  id: text("id").primaryKey(),
  lastEventType: text("last_event_type").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").notNull(),
  status: text("status").notNull()
});

export function createDrizzleDatabase(url: string) {
  const client = postgres(url);
  return { client, db: drizzle(client) };
}
