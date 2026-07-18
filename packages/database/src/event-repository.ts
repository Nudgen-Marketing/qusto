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

function traceAmount(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,77})$/.test(value)) {
    throw new Error("Invalid atomic amount");
  }
  return value;
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
        const amountAtomic = traceAmount(event.payload.amountAtomic);
        const asset =
          typeof event.payload.asset === "string" ? event.payload.asset : null;
        const network =
          typeof event.payload.network === "string"
            ? event.payload.network
            : null;
        const payee =
          typeof event.payload.payee === "string" ? event.payload.payee : null;
        const payer =
          typeof event.payload.payer === "string" ? event.payload.payer : null;
        const protocolVersion =
          typeof event.payload.protocolVersion === "number"
            ? event.payload.protocolVersion
            : null;
        const resourceUrl =
          typeof event.payload.resourceUrl === "string"
            ? event.payload.resourceUrl
            : null;
        const transactionHash =
          typeof event.payload.transactionHash === "string"
            ? event.payload.transactionHash
            : null;
        const policyOutcome =
          event.type === "policy.allowed"
            ? "allow"
            : event.type === "policy.denied"
              ? "deny"
              : null;
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
        const projection = await sql<{ environment_id: string }[]>`
          INSERT INTO traces (
            id, environment_id, status, last_event_type, protocol_version,
            network, asset, amount_atomic, payer, payee, resource_url,
            transaction_hash, policy_outcome, first_seen_at, last_seen_at, metadata
          ) VALUES (
            ${event.traceId}, ${event.environmentId}, ${traceStatus(event.type)}, ${event.type},
            ${protocolVersion}, ${network}, ${asset}, ${amountAtomic}, ${payer}, ${payee},
            ${resourceUrl}, ${transactionHash}, ${policyOutcome},
            ${event.occurredAt}, ${event.occurredAt}, ${payload}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            last_event_type = EXCLUDED.last_event_type,
            protocol_version = COALESCE(EXCLUDED.protocol_version, traces.protocol_version),
            network = COALESCE(EXCLUDED.network, traces.network),
            asset = COALESCE(EXCLUDED.asset, traces.asset),
            amount_atomic = COALESCE(EXCLUDED.amount_atomic, traces.amount_atomic),
            payer = COALESCE(EXCLUDED.payer, traces.payer),
            payee = COALESCE(EXCLUDED.payee, traces.payee),
            resource_url = COALESCE(EXCLUDED.resource_url, traces.resource_url),
            transaction_hash = COALESCE(EXCLUDED.transaction_hash, traces.transaction_hash),
            policy_outcome = COALESCE(EXCLUDED.policy_outcome, traces.policy_outcome),
            last_seen_at = GREATEST(traces.last_seen_at, EXCLUDED.last_seen_at),
            metadata = traces.metadata || EXCLUDED.metadata
          WHERE traces.environment_id = EXCLUDED.environment_id
          RETURNING environment_id
        `;
        if (projection.length === 0) {
          throw new Error("Trace ID belongs to another environment");
        }
        if (event.type === "settlement.submitted") {
          const transactionHash = event.payload.transactionHash;
          if (
            typeof transactionHash === "string" &&
            transactionHash.length > 0
          ) {
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
