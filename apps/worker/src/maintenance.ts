import postgres from "postgres";

const partitionPattern = /^trace_events_(\d{4})(\d{2})(\d{2})$/;

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dayValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function partitionName(date: Date): string {
  return `trace_events_${dayValue(date).replaceAll("-", "")}`;
}

function dateFromPartition(name: string): Date | undefined {
  const match = partitionPattern.exec(name);
  if (match === null) return undefined;
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export class PostgresMaintenance {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 2 });
  }

  async ensureTracePartitions(now: Date, daysAhead = 7): Promise<void> {
    const boundedDays = Math.max(1, Math.min(31, Math.floor(daysAhead)));
    for (let offset = 0; offset < boundedDays; offset += 1) {
      const start = addUtcDays(now, offset);
      const end = addUtcDays(start, 1);
      const name = partitionName(start);
      await this.client.unsafe(
        `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF trace_events FOR VALUES FROM ('${dayValue(start)}') TO ('${dayValue(end)}')`
      );
    }
  }

  async dropExpiredTracePartitions(
    now: Date,
    retentionDays: number
  ): Promise<readonly string[]> {
    const boundedRetention = Math.max(1, Math.floor(retentionDays));
    const cutoff = addUtcDays(now, -boundedRetention);
    const partitions = await this.client<{ name: string }[]>`
      SELECT child.relname AS name
      FROM pg_inherits
      JOIN pg_class parent ON parent.oid = inhparent
      JOIN pg_class child ON child.oid = inhrelid
      WHERE parent.relname = 'trace_events'
    `;
    const dropped: string[] = [];
    for (const { name } of partitions) {
      const start = dateFromPartition(name);
      if (start === undefined || addUtcDays(start, 1) > cutoff) continue;
      await this.client.unsafe(`DROP TABLE IF EXISTS "${name}"`);
      dropped.push(name);
    }
    return dropped;
  }

  async refreshHourlyRollups(): Promise<void> {
    await this.client`
      INSERT INTO hourly_rollups (
        environment_id, bucket, payments, denies, failures, spend_atomic
      )
      SELECT
        environment_id,
        date_trunc('hour', last_seen_at) AS bucket,
        count(*)::bigint AS payments,
        count(*) FILTER (WHERE status = 'denied')::bigint AS denies,
        count(*) FILTER (WHERE status = 'failed')::bigint AS failures,
        COALESCE(sum(amount_atomic), 0) AS spend_atomic
      FROM traces
      WHERE last_seen_at >= date_trunc('hour', now()) - interval '1 hour'
      GROUP BY environment_id, date_trunc('hour', last_seen_at)
      ON CONFLICT (environment_id, bucket) DO UPDATE SET
        payments = EXCLUDED.payments,
        denies = EXCLUDED.denies,
        failures = EXCLUDED.failures,
        spend_atomic = EXCLUDED.spend_atomic
    `;
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
