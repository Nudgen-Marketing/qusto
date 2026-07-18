import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { ingestEvents } from "@qusto/control-plane";
import { PostgresEventRepository } from "@qusto/database/public-runtime";

import { decryptSecret } from "./secret-box.js";
import { deliverWebhook } from "./webhook-delivery.js";
import { reconcileTransaction } from "./reconciliation.js";
import type { JobHandler } from "./worker-loop.js";
import type { Job } from "./job-repository.js";
import type { RpcCall } from "./reconciliation.js";

interface DeliveryRow {
  id: string;
  payload: Record<string, unknown>;
  secret_ciphertext: string;
  url: string;
}

function payloadString(job: Job, key: string): string {
  const value = job.payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Job ${job.id} is missing ${key}`);
  }
  return value;
}

export class PostgresWorkerOperations {
  private readonly client: postgres.Sql;
  private readonly events: PostgresEventRepository;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
    this.events = new PostgresEventRepository(url);
  }

  async deliverWebhookJob(job: Job, encryptionKey: string): Promise<void> {
    const deliveryId = payloadString(job, "deliveryId");
    const rows = await this.client<DeliveryRow[]>`
      UPDATE webhook_deliveries AS delivery
      SET attempt = delivery.attempt + 1
      FROM webhooks AS webhook
      WHERE delivery.id = ${deliveryId}
        AND webhook.id = delivery.webhook_id
        AND webhook.enabled = true
        AND delivery.delivered_at IS NULL
      RETURNING delivery.id, delivery.payload, webhook.url, webhook.secret_ciphertext
    `;
    const delivery = rows[0];
    if (delivery === undefined) return;
    try {
      const status = await deliverWebhook({
        deliveryId: delivery.id,
        payload: delivery.payload,
        secret: decryptSecret(delivery.secret_ciphertext, encryptionKey),
        url: delivery.url
      });
      await this.client`
        UPDATE webhook_deliveries
        SET status_code = ${status}, delivered_at = now(), last_error = NULL,
            next_attempt_at = NULL
        WHERE id = ${deliveryId}
      `;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 2000)
          : "Webhook failed";
      await this.client`
        UPDATE webhook_deliveries
        SET last_error = ${message}, next_attempt_at = now() + interval '1 minute'
        WHERE id = ${deliveryId}
      `;
      throw error;
    }
  }

  async reconcileJob(job: Job, rpc: RpcCall): Promise<void> {
    const environmentId = payloadString(job, "environmentId");
    const traceId = payloadString(job, "traceId");
    const transactionHash = payloadString(job, "transactionHash");
    const types = await reconcileTransaction(transactionHash, rpc);
    if (types.length === 0) throw new Error("Transaction receipt is pending");
    const existing = await this.client<{ event_type: string }[]>`
      SELECT DISTINCT event_type
      FROM trace_events
      WHERE environment_id = ${environmentId}
        AND trace_id = ${traceId}
        AND event_type = ANY(${this.client.array([...types])})
    `;
    const existingTypes = new Set(existing.map(({ event_type }) => event_type));
    const occurredAt = new Date().toISOString();
    const events = types
      .filter((type) => !existingTypes.has(type))
      .map((type) => ({
        environmentId,
        eventId: `evt_${randomUUID()}`,
        occurredAt,
        payload: { transactionHash },
        traceId,
        type
      }));
    if (events.length > 0) await ingestEvents(events, this.events);
    if (
      !types.includes("chain.finalized") &&
      !types.includes("chain.reverted")
    ) {
      throw new Error("Transaction is confirmed but not finalized");
    }
  }

  async ensureScheduledJobs(): Promise<void> {
    for (const type of [
      "maintenance.partitions",
      "maintenance.retention",
      "rollups.refresh"
    ]) {
      await this.client`
        INSERT INTO jobs (type, payload, run_at)
        VALUES (${type}, '{}'::jsonb, now())
        ON CONFLICT DO NOTHING
      `;
    }
  }

  async maxTraceRetentionDays(): Promise<number> {
    const rows = await this.client<{ days: number }[]>`
      SELECT COALESCE(MAX(trace_retention_days), 90)::integer AS days FROM environments
    `;
    return rows[0]?.days ?? 90;
  }

  handlers(options: {
    readonly encryptionKey: string;
    readonly maintenance: {
      ensureTracePartitions(now: Date, daysAhead: number): Promise<void>;
      dropExpiredTracePartitions(
        now: Date,
        days: number
      ): Promise<readonly string[]>;
      refreshHourlyRollups(): Promise<void>;
    };
    readonly rpc: RpcCall;
  }): Readonly<Record<string, JobHandler>> {
    return {
      "chain.reconcile": (job) => this.reconcileJob(job, options.rpc),
      "maintenance.partitions": () =>
        options.maintenance.ensureTracePartitions(new Date(), 8),
      "maintenance.retention": async () => {
        await options.maintenance.dropExpiredTracePartitions(
          new Date(),
          await this.maxTraceRetentionDays()
        );
      },
      "rollups.refresh": () => options.maintenance.refreshHourlyRollups(),
      "webhook.deliver": (job) =>
        this.deliverWebhookJob(job, options.encryptionKey)
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.events.close(), this.client.end()]);
  }
}
