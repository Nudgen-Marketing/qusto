import postgres from "postgres";
import type {
  EventInsertResult,
  EventRepository,
  TraceEvent
} from "@qusto/control-plane";

function traceStatus(type: TraceEvent["type"]): string {
  if (type === "policy.denied") return "denied";
  if (type === "chain.finalized") return "finalized";
  if (type === "chain.reverted" || type.endsWith(".failed")) return "failed";
  if (type === "settlement.succeeded" || type === "chain.confirmed")
    return "settled";
  return "in_progress";
}

export class PostgresEventRepository implements EventRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 10 });
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async insertEvents(
    events: readonly TraceEvent[]
  ): Promise<EventInsertResult> {
    const accepted: string[] = [];
    const duplicates: string[] = [];

    await this.client.begin(async (sql) => {
      for (const event of events) {
        const payload = JSON.stringify(event.payload);
        const inserted = await sql<{ id: string }[]>`
          INSERT INTO trace_event_dedup (id, occurred_at)
          VALUES (${event.eventId}, ${event.occurredAt})
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (inserted.length === 0) {
          duplicates.push(event.eventId);
          continue;
        }

        await sql`
          INSERT INTO trace_events (
            id, environment_id, trace_id, event_type, payload, occurred_at
          ) VALUES (
            ${event.eventId}, ${event.environmentId}, ${event.traceId}, ${event.type},
            ${payload}::jsonb, ${event.occurredAt}
          )
        `;
        await sql`
          INSERT INTO traces (
            id, environment_id, status, last_event_type, first_seen_at, last_seen_at, metadata
          ) VALUES (
            ${event.traceId}, ${event.environmentId}, ${traceStatus(event.type)}, ${event.type},
            ${event.occurredAt}, ${event.occurredAt}, ${payload}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            last_event_type = EXCLUDED.last_event_type,
            last_seen_at = GREATEST(traces.last_seen_at, EXCLUDED.last_seen_at),
            metadata = traces.metadata || EXCLUDED.metadata
        `;
        if (event.type === "settlement.submitted") {
          const transactionHash = event.payload.transactionHash;
          if (typeof transactionHash === "string" && transactionHash.length > 0) {
            await sql`
              INSERT INTO jobs (type, payload)
              VALUES (
                'chain.reconcile',
                ${JSON.stringify({
                  environmentId: event.environmentId,
                  traceId: event.traceId,
                  transactionHash
                })}::jsonb
              )
            `;
          }
        }
        if (
          event.type === "policy.denied" ||
          event.type === "settlement.failed" ||
          event.type === "chain.reverted"
        ) {
          const webhookPayload = JSON.stringify({
            eventId: event.eventId,
            occurredAt: event.occurredAt,
            traceId: event.traceId,
            type: event.type,
            version: 1
          });
          const deliveries = await sql<{ id: string }[]>`
            INSERT INTO webhook_deliveries (webhook_id, event_type, payload, next_attempt_at)
            SELECT id, ${event.type}, ${webhookPayload}::jsonb, now()
            FROM webhooks
            WHERE environment_id = ${event.environmentId}
              AND enabled = true
              AND event_types @> ARRAY[${event.type}]::text[]
            RETURNING id
          `;
          for (const delivery of deliveries) {
            await sql`
              INSERT INTO jobs (type, payload)
              VALUES (
                'webhook.deliver',
                ${JSON.stringify({ deliveryId: delivery.id })}::jsonb
              )
            `;
          }
        }
        accepted.push(event.eventId);
      }
    });

    return { accepted, duplicates };
  }
}
