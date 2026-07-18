import { AsyncLocalStorage } from "node:async_hooks";

import postgres from "postgres";
import type {
  EvaluationRepository,
  PersistedDecision
} from "@qusto/control-plane";

type Transaction = postgres.TransactionSql<Record<string, never>>;

interface DecisionRow {
  amount_atomic: string;
  asset: string;
  environment_id: string;
  id: string;
  idempotency_key: string;
  outcome: "allow" | "deny";
  payee: string;
  payer: string;
  policy_version_id: string;
  reason_codes: string[];
  reservation_expires_at: Date | null;
  reservation_id: string | null;
  rule_ids: string[];
  trace_id: string;
}

export class PostgresEvaluationRepository implements EvaluationRepository {
  private readonly client: postgres.Sql;
  private readonly transaction = new AsyncLocalStorage<Transaction>();

  constructor(url: string) {
    this.client = postgres(url, { max: 10 });
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async findDecision(
    environmentId: string,
    idempotencyKey: string
  ): Promise<PersistedDecision | undefined> {
    const sql = this.currentClient();
    const rows = await sql<DecisionRow[]>`
      SELECT
        d.id,
        d.environment_id,
        d.policy_version_id,
        d.trace_id,
        d.idempotency_key,
        d.outcome,
        d.reason_codes,
        d.rule_ids,
        d.payer,
        d.payee,
        d.asset,
        d.amount_atomic::text,
        r.id AS reservation_id,
        r.expires_at AS reservation_expires_at
      FROM policy_decisions d
      LEFT JOIN spend_reservations r ON r.decision_id = d.id
      WHERE d.environment_id = ${environmentId} AND d.idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? undefined : this.toDecision(row);
  }

  async getRollingSpend(
    environmentId: string,
    payer: string,
    asset: string,
    windowSeconds: number
  ): Promise<string> {
    const sql = this.currentClient();
    const rows = await sql<{ amount: string }[]>`
      SELECT (
        COALESCE((
          SELECT SUM(amount_atomic)
          FROM spend_ledger
          WHERE environment_id = ${environmentId}
            AND lower(payer) = lower(${payer})
            AND lower(asset) = lower(${asset})
            AND settled_at >= now() - (${windowSeconds} * interval '1 second')
        ), 0)
        +
        COALESCE((
          SELECT SUM(amount_atomic)
          FROM spend_reservations
          WHERE environment_id = ${environmentId}
            AND lower(payer) = lower(${payer})
            AND lower(asset) = lower(${asset})
            AND status = 'active'
            AND expires_at > now()
        ), 0)
      )::text AS amount
    `;

    return rows[0]?.amount ?? "0";
  }

  async saveDecision(decision: PersistedDecision): Promise<PersistedDecision> {
    const sql = this.currentClient();
    await sql`
      INSERT INTO policy_decisions (
        id, environment_id, policy_version_id, trace_id, idempotency_key, outcome,
        reason_codes, rule_ids, payer, payee, asset, amount_atomic
      ) VALUES (
        ${decision.decisionId}, ${decision.environmentId}, ${decision.policyVersionId},
        ${decision.traceId}, ${decision.idempotencyKey}, ${decision.outcome},
        ${sql.array([...decision.reasonCodes])}, ${sql.array([...(decision.ruleIds ?? [])])},
        ${decision.payer}, ${decision.payee}, ${decision.asset}, ${decision.amountAtomic}
      )
    `;

    if (
      decision.reservationId !== undefined &&
      decision.reservationExpiresAt !== undefined
    ) {
      await sql`
        INSERT INTO spend_reservations (
          id, environment_id, decision_id, payer, asset, amount_atomic, expires_at
        ) VALUES (
          ${decision.reservationId}, ${decision.environmentId}, ${decision.decisionId},
          ${decision.payer}, ${decision.asset}, ${decision.amountAtomic},
          ${decision.reservationExpiresAt}
        )
      `;
    }

    return decision;
  }

  async withBudgetLock<T>(
    scope: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const result = await this.client.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
      return this.transaction.run(transaction, operation);
    });

    return result as T;
  }

  private currentClient(): postgres.Sql | Transaction {
    return this.transaction.getStore() ?? this.client;
  }

  private toDecision(row: DecisionRow): PersistedDecision {
    const reservation =
      row.reservation_id === null || row.reservation_expires_at === null
        ? {}
        : {
            reservationExpiresAt: row.reservation_expires_at.toISOString(),
            reservationId: row.reservation_id
          };
    const rules = row.rule_ids.length === 0 ? {} : { ruleIds: row.rule_ids };

    return {
      amountAtomic: row.amount_atomic,
      asset: row.asset,
      decisionId: row.id,
      environmentId: row.environment_id,
      idempotencyKey: row.idempotency_key,
      outcome: row.outcome,
      payee: row.payee,
      payer: row.payer,
      policyVersionId: row.policy_version_id,
      reasonCodes: row.reason_codes as PersistedDecision["reasonCodes"],
      ...reservation,
      ...rules,
      traceId: row.trace_id
    };
  }
}
