import postgres from "postgres";
import type { PolicyRule } from "@qusto/policy-engine";

export interface ActivePolicy {
  readonly id: string;
  readonly rules: readonly PolicyRule[];
}

export class PostgresRuntimeRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
  }

  async getActivePolicy(
    environmentId: string
  ): Promise<ActivePolicy | undefined> {
    const rows = await this.client<{ id: string; rules: PolicyRule[] }[]>`
      SELECT pv.id, pv.rules
      FROM environments e
      JOIN policy_versions pv ON pv.id = e.active_policy_version_id
      WHERE e.id = ${environmentId} AND pv.status = 'published'
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined
      ? undefined
      : { id: row.id, rules: structuredClone(row.rules) };
  }

  async isReady(): Promise<boolean> {
    try {
      const rows = await this.client<{ ready: number }[]>`SELECT 1 AS ready`;
      return rows[0]?.ready === 1;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
