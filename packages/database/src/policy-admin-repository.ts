import { AsyncLocalStorage } from "node:async_hooks";

import postgres from "postgres";
import type {
  PolicyAdminRepository,
  PolicyVersion
} from "@qusto/control-plane";
import type { PolicyRule } from "@qusto/policy-engine";

type Transaction = postgres.TransactionSql<Record<string, never>>;

interface PolicyRow {
  created_by: string | null;
  environment_id: string;
  id: string;
  published_at: Date | null;
  published_by: string | null;
  rules: PolicyRule[];
  status: PolicyVersion["status"];
  version: number;
}

export class PostgresPolicyAdminRepository implements PolicyAdminRepository {
  private readonly client: postgres.Sql;
  private readonly environmentId: string;
  private readonly transactionStorage = new AsyncLocalStorage<Transaction>();

  constructor(url: string, environmentId: string) {
    this.client = postgres(url, { max: 5 });
    this.environmentId = environmentId;
  }

  async appendAudit(
    action: string,
    details: Readonly<Record<string, unknown>> = {}
  ): Promise<void> {
    const sql = this.currentClient();
    const actorUserId =
      typeof details.actorUserId === "string" ? details.actorUserId : undefined;
    const targetId =
      typeof details.policyVersionId === "string"
        ? details.policyVersionId
        : this.environmentId;
    await sql`
      INSERT INTO audit_entries (
        organization_id, actor_user_id, action, target_type, target_id, metadata
      )
      SELECT
        p.organization_id,
        (SELECT id FROM users WHERE id = ${actorUserId ?? null} LIMIT 1),
        ${action},
        'policy_version',
        ${targetId},
        ${JSON.stringify(details)}::jsonb
      FROM environments e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = ${this.environmentId}
    `;
  }

  async createVersion(version: PolicyVersion): Promise<PolicyVersion> {
    if (version.environmentId !== this.environmentId) {
      throw new Error("Policy environment mismatch");
    }
    const sql = this.currentClient();
    await sql`
      INSERT INTO policy_versions (
        id, environment_id, version, status, rules, published_at, published_by, created_by
      ) VALUES (
        ${version.id}, ${version.environmentId}, ${version.version}, ${version.status},
        ${JSON.stringify(version.rules)}::jsonb, ${version.publishedAt ?? null},
        (SELECT id FROM users WHERE id = ${version.publishedBy ?? null} LIMIT 1),
        (SELECT id FROM users WHERE id = ${version.createdBy} LIMIT 1)
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        published_at = EXCLUDED.published_at,
        published_by = EXCLUDED.published_by
      WHERE policy_versions.status = 'draft'
    `;
    return version;
  }

  async findVersion(id: string): Promise<PolicyVersion | undefined> {
    const rows = await this.currentClient()<PolicyRow[]>`
      SELECT id, environment_id, version, status, rules, published_at, published_by, created_by
      FROM policy_versions
      WHERE id = ${id} AND environment_id = ${this.environmentId}
      LIMIT 1
    `;
    const row = rows[0];
    if (row === undefined) return undefined;
    return {
      createdBy: row.created_by ?? "system",
      environmentId: row.environment_id,
      id: row.id,
      ...(row.published_at === null
        ? {}
        : { publishedAt: row.published_at.toISOString() }),
      ...(row.published_by === null ? {} : { publishedBy: row.published_by }),
      rules: structuredClone(row.rules),
      status: row.status,
      version: row.version
    };
  }

  async getNextVersion(environmentId: string): Promise<number> {
    if (environmentId !== this.environmentId) {
      throw new Error("Policy environment mismatch");
    }
    const rows = await this.currentClient()<{ version: number }[]>`
      SELECT COALESCE(MAX(version), 0)::integer + 1 AS version
      FROM policy_versions
      WHERE environment_id = ${environmentId}
    `;
    return rows[0]?.version ?? 1;
  }

  async setActiveVersion(id: string): Promise<void> {
    await this.currentClient()`
      UPDATE environments SET active_policy_version_id = ${id}, updated_at = now()
      WHERE id = ${this.environmentId}
    `;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionStorage.getStore() !== undefined) return operation();
    const result = await this.client.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${this.environmentId}`}, 0))
      `;
      return this.transactionStorage.run(transaction, operation);
    });
    return result as T;
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  private currentClient(): postgres.Sql | Transaction {
    return this.transactionStorage.getStore() ?? this.client;
  }
}
