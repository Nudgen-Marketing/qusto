import { timingSafeEqual } from "node:crypto";

import postgres from "postgres";
import { parseAndHashApiKey } from "@qusto/control-plane";

export interface AuthenticatedApiKey {
  readonly environmentId: string;
}

export class PostgresApiKeyRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
  }

  async authenticate(token: string): Promise<AuthenticatedApiKey | undefined> {
    let digest: ReturnType<typeof parseAndHashApiKey>;
    try {
      digest = parseAndHashApiKey(token);
    } catch {
      return undefined;
    }
    const rows = await this.client<
      { environment_id: string; secret_hash: string }[]
    >`
      SELECT environment_id, secret_hash
      FROM api_keys
      WHERE lookup = ${digest.lookup} AND revoked_at IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (row === undefined) return undefined;
    const expected = Buffer.from(row.secret_hash, "hex");
    const actual = Buffer.from(digest.secretHash, "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return undefined;
    }
    await this.client`
      UPDATE api_keys SET last_used_at = now() WHERE lookup = ${digest.lookup}
    `;
    return { environmentId: row.environment_id };
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
