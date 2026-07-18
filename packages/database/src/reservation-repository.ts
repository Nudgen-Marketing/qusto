import { AsyncLocalStorage } from "node:async_hooks";

import postgres from "postgres";
import type {
  Reservation,
  ReservationCompletion,
  ReservationRepository
} from "@qusto/control-plane";

type Transaction = postgres.TransactionSql<Record<string, never>>;

interface ReservationRow {
  amount_atomic: string;
  asset: string;
  environment_id: string;
  expires_at: Date;
  id: string;
  payee: string;
  payer: string;
  status: Reservation["status"];
  trace_id: string;
}

export class PostgresReservationRepository implements ReservationRepository {
  private readonly client: postgres.Sql;
  private readonly transactionStorage = new AsyncLocalStorage<Transaction>();

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
  }

  async findForUpdate(id: string): Promise<Reservation | undefined> {
    const rows = await this.currentClient()<ReservationRow[]>`
      SELECT
        r.id, r.environment_id, r.payer, d.payee, r.asset,
        r.amount_atomic::text, r.status, r.expires_at, d.trace_id
      FROM spend_reservations r
      JOIN policy_decisions d ON d.id = r.decision_id
      WHERE r.id = ${id}
      FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          amountAtomic: row.amount_atomic,
          asset: row.asset,
          environmentId: row.environment_id,
          expiresAt: row.expires_at.toISOString(),
          id: row.id,
          payee: row.payee,
          payer: row.payer,
          status: row.status,
          traceId: row.trace_id
        };
  }

  async insertLedger(
    reservation: Reservation,
    completion: ReservationCompletion
  ): Promise<void> {
    await this.currentClient()`
      INSERT INTO spend_ledger (
        environment_id, reservation_id, trace_id, payer, payee, asset,
        amount_atomic, transaction_hash, settled_at
      ) VALUES (
        ${reservation.environmentId}, ${reservation.id}, ${reservation.traceId},
        ${reservation.payer}, ${reservation.payee}, ${reservation.asset},
        ${reservation.amountAtomic}, ${completion.transactionHash ?? null},
        ${completion.settledAt}
      )
      ON CONFLICT (reservation_id) DO NOTHING
    `;
  }

  async setStatus(id: string, status: Reservation["status"]): Promise<void> {
    await this.currentClient()`
      UPDATE spend_reservations
      SET status = ${status},
          completed_at = CASE WHEN ${status} = 'completed' THEN now() ELSE completed_at END
      WHERE id = ${id}
    `;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionStorage.getStore() !== undefined) return operation();
    const result = await this.client.begin((transaction) =>
      this.transactionStorage.run(transaction, operation)
    );
    return result as T;
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  private currentClient(): postgres.Sql | Transaction {
    return this.transactionStorage.getStore() ?? this.client;
  }
}
