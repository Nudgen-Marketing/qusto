import postgres from "postgres";

export interface Job {
  readonly attempts: number;
  readonly id: string;
  readonly maxAttempts: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly type: string;
}

interface JobRow {
  attempts: number;
  id: string;
  max_attempts: number;
  payload: Record<string, unknown>;
  type: string;
}

export class PostgresJobRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
  }

  async claim(workerId: string, limit: number): Promise<readonly Job[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = await this.client<JobRow[]>`
      WITH candidates AS (
        SELECT id
        FROM jobs
        WHERE status IN ('pending', 'failed')
          AND run_at <= now()
          AND attempts < max_attempts
        ORDER BY run_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${safeLimit}
      )
      UPDATE jobs AS job
      SET status = 'running',
          attempts = job.attempts + 1,
          locked_at = now(),
          locked_by = ${workerId},
          updated_at = now()
      FROM candidates
      WHERE job.id = candidates.id
      RETURNING job.id, job.type, job.payload, job.attempts, job.max_attempts
    `;
    return rows.map((row) => ({
      attempts: row.attempts,
      id: row.id,
      maxAttempts: row.max_attempts,
      payload: structuredClone(row.payload),
      type: row.type
    }));
  }

  async complete(job: Job): Promise<void> {
    await this.client`
      UPDATE jobs
      SET status = 'completed', locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE id = ${job.id} AND status = 'running'
    `;
  }

  async fail(job: Job, error: unknown): Promise<void> {
    const delaySeconds = Math.min(3600, 2 ** Math.min(job.attempts, 12));
    const message =
      error instanceof Error
        ? error.message.slice(0, 2000)
        : "Unknown worker failure";
    await this.client`
      UPDATE jobs
      SET status = 'failed',
          run_at = now() + (${delaySeconds} * interval '1 second'),
          locked_at = NULL,
          locked_by = NULL,
          last_error = ${message},
          updated_at = now()
      WHERE id = ${job.id} AND status = 'running'
    `;
  }

  async heartbeat(workerId: string): Promise<void> {
    await this.client`
      INSERT INTO worker_heartbeats (worker_id, last_seen_at)
      VALUES (${workerId}, now())
      ON CONFLICT (worker_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
    `;
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
