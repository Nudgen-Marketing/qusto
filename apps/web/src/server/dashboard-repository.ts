import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { createApiKey, hashInvitationToken } from "@qusto/control-plane";
import {
  spendRanges,
  type DashboardData,
  type PolicyHealthSummary,
  type SpendPoint,
  type SpendRange,
  type SpendTrend,
  type TraceRow
} from "../components/dashboard/demo-data";
import { validatePolicyRules } from "./dashboard-permissions";

const baseMainnet = "eip155:8453";
const baseUsdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const spendRangeConfiguration: Readonly<
  Record<
    SpendRange,
    { readonly bucketSeconds: number; readonly durationMs: number }
  >
> = {
  "1H": { bucketSeconds: 300, durationMs: 60 * 60_000 },
  "6H": { bucketSeconds: 1_800, durationMs: 6 * 60 * 60_000 },
  "24H": { bucketSeconds: 3_600, durationMs: 24 * 60 * 60_000 },
  "7D": { bucketSeconds: 21_600, durationMs: 7 * 24 * 60 * 60_000 },
  "30D": { bucketSeconds: 86_400, durationMs: 30 * 24 * 60 * 60_000 }
};

export type DashboardRole = "admin" | "developer" | "viewer";

export interface DashboardContext {
  readonly environmentId: string;
  readonly environmentName: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly role: DashboardRole;
}

interface TraceProjectionRow {
  amount_atomic: string | null;
  id: string;
  last_seen_at: Date;
  metadata: Record<string, unknown>;
  network: string | null;
  payer: string | null;
  policy_outcome: "allow" | "deny" | null;
  resource_url: string | null;
  transaction_hash: string | null;
}

interface PolicyVersionProjection {
  readonly rules: unknown;
  readonly status: string;
}

export function summarizePolicyHealth(
  versions: readonly PolicyVersionProjection[]
): PolicyHealthSummary {
  return versions.reduce<PolicyHealthSummary>(
    (summary, version) => {
      try {
        validatePolicyRules(version.rules);
      } catch {
        return { ...summary, error: summary.error + 1 };
      }
      if (version.status === "draft") {
        return { ...summary, warning: summary.warning + 1 };
      }
      if (version.status === "published" || version.status === "archived") {
        return { ...summary, healthy: summary.healthy + 1 };
      }
      return { ...summary, error: summary.error + 1 };
    },
    { error: 0, healthy: 0, total: versions.length, warning: 0 }
  );
}

function compact(value: string | null, fallback = "—"): string {
  if (value === null || value.length === 0) return fallback;
  return value.length > 18
    ? `${value.slice(0, 8)}...${value.slice(-6)}`
    : value;
}

function formatUsdc(amount: string | null): string {
  if (amount === null) return "—";
  const value = BigInt(amount);
  const whole = value / 1_000_000n;
  const decimals = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 4);
  return `${whole.toString()}.${decimals} USDC`;
}

function traceRow(row: TraceProjectionRow): TraceRow {
  return {
    amount: formatUsdc(row.amount_atomic),
    id: row.id,
    latency:
      typeof row.metadata.latencyMs === "number"
        ? `${String(row.metadata.latencyMs)} ms`
        : "—",
    payer: compact(row.payer),
    policy:
      typeof row.metadata.policyName === "string"
        ? row.metadata.policyName
        : "active policy",
    resource: row.resource_url ?? "Unknown resource",
    status: row.policy_outcome === "deny" ? "DENY" : "ALLOW",
    time: row.last_seen_at.toISOString().slice(11, 19)
  };
}

export class PostgresDashboardRepository {
  private readonly client: postgres.Sql;

  constructor(url: string) {
    this.client = postgres(url, { max: 10 });
  }

  async userCount(): Promise<number> {
    const rows = await this.client<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM users
    `;
    return rows[0]?.count ?? 0;
  }

  async contextForUser(
    userId: string,
    environmentName = "production"
  ): Promise<DashboardContext | undefined> {
    const rows = await this.client<
      {
        environment_id: string;
        environment_name: string;
        organization_id: string;
        project_id: string;
        project_name: string;
        role: DashboardRole;
      }[]
    >`
      SELECT
        e.id AS environment_id, e.name::text AS environment_name,
        p.id AS project_id, p.name AS project_name,
        p.organization_id, m.role::text AS role
      FROM memberships m
      JOIN projects p ON p.organization_id = m.organization_id
      JOIN environments e ON e.project_id = p.id
      WHERE m.user_id = ${userId}
      ORDER BY (e.name::text = ${environmentName}) DESC, p.created_at, e.created_at
      LIMIT 1
    `;
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          environmentId: row.environment_id,
          environmentName: row.environment_name,
          organizationId: row.organization_id,
          projectId: row.project_id,
          projectName: row.project_name,
          role: row.role
        };
  }

  private async spendSeries(
    environmentId: string,
    range: SpendRange,
    now: Date
  ): Promise<readonly SpendPoint[]> {
    const configuration = spendRangeConfiguration[range];
    const start = new Date(now.getTime() - configuration.durationMs);
    const lastIncludedInstant = new Date(now.getTime() - 1);
    const rows = await this.client<{ amount_atomic: string; bucket: Date }[]>`
      WITH bounds AS (
        SELECT
          date_bin(
            make_interval(secs => ${configuration.bucketSeconds}),
            ${start},
            TIMESTAMPTZ '2000-01-01 00:00:00+00'
          ) AS first_bucket,
          date_bin(
            make_interval(secs => ${configuration.bucketSeconds}),
            ${lastIncludedInstant},
            TIMESTAMPTZ '2000-01-01 00:00:00+00'
          ) AS last_bucket
      ), buckets AS (
        SELECT generate_series(
          first_bucket,
          last_bucket,
          make_interval(secs => ${configuration.bucketSeconds})
        ) AS bucket
        FROM bounds
      )
      SELECT
        buckets.bucket,
        COALESCE(sum(traces.amount_atomic), 0)::text AS amount_atomic
      FROM buckets
      LEFT JOIN traces ON
        traces.environment_id = ${environmentId}
        AND traces.last_seen_at >= GREATEST(buckets.bucket, ${start})
        AND traces.last_seen_at < LEAST(
          buckets.bucket + make_interval(secs => ${configuration.bucketSeconds}),
          ${now}
        )
        AND traces.status IN ('settled', 'finalized')
        AND traces.network = ${baseMainnet}
        AND lower(traces.asset) = lower(${baseUsdc})
      GROUP BY buckets.bucket
      ORDER BY buckets.bucket
    `;
    return rows.map((row) => ({
      amountAtomic: row.amount_atomic,
      timestamp: row.bucket.toISOString()
    }));
  }

  async overview(
    context: DashboardContext,
    now = new Date()
  ): Promise<DashboardData> {
    const metricWindowStart = new Date(now.getTime() - 24 * 60 * 60_000);
    const [metrics, traces, policyVersions, spendSeries] = await Promise.all([
      this.client<{ denied: string; payments: string; spend: string }[]>`
        SELECT
          count(*)::text AS payments,
          count(*) FILTER (WHERE policy_outcome = 'deny')::text AS denied,
          COALESCE(sum(amount_atomic) FILTER (
            WHERE status IN ('settled', 'finalized')
              AND network = ${baseMainnet}
              AND lower(asset) = lower(${baseUsdc})
          ), 0)::text AS spend
        FROM traces
        WHERE environment_id = ${context.environmentId}
          AND last_seen_at >= ${metricWindowStart}
          AND last_seen_at < ${now}
      `,
      this.client<TraceProjectionRow[]>`
        SELECT
          id, amount_atomic::text, payer, resource_url, policy_outcome, network,
          transaction_hash, last_seen_at, metadata
        FROM traces
        WHERE environment_id = ${context.environmentId}
        ORDER BY last_seen_at DESC
        LIMIT 50
      `,
      this.listPolicyVersions(context.environmentId),
      Promise.all(
        spendRanges.map(
          async (range) =>
            [
              range,
              await this.spendSeries(context.environmentId, range, now)
            ] as const
        )
      )
    ]);
    const metric = metrics[0];
    const spendTrend = Object.fromEntries(spendSeries) as SpendTrend;
    const rows = traces.map(traceRow);
    const selectedProjection = traces[0];
    const selected = rows[0] ?? {
      amount: "—",
      id: "no-traces",
      latency: "—",
      payer: "—",
      policy: "active policy",
      resource: "Waiting for instrumented x402 traffic",
      status: "ALLOW" as const,
      time: "—"
    };
    const timeline =
      selectedProjection === undefined
        ? []
        : await this.client<{ event_type: string; occurred_at: Date }[]>`
            SELECT event_type, occurred_at
            FROM trace_events
            WHERE trace_id = ${selectedProjection.id}
            ORDER BY occurred_at
          `;
    return {
      metrics: [
        {
          change: "live",
          changeTone: "success",
          label: "Total spend",
          value: formatUsdc(metric?.spend ?? "0")
        },
        {
          change: "24h",
          changeTone: "success",
          label: "Payments",
          value: metric?.payments ?? "0"
        },
        {
          change: "24h",
          changeTone: Number(metric?.denied ?? 0) > 0 ? "danger" : "success",
          label: "Denied",
          value: metric?.denied ?? "0"
        },
        {
          change: "target <100 ms",
          changeTone: "success",
          label: "P95 decision",
          value: "—"
        }
      ],
      policyHealth: summarizePolicyHealth(policyVersions),
      selectedTrace: {
        ...selected,
        network: selectedProjection?.network ?? "Base",
        transaction: compact(selectedProjection?.transaction_hash ?? null)
      },
      spendTrend,
      timeline: timeline.map((event) => ({
        duration: "",
        label: event.event_type.replaceAll(".", " "),
        time: event.occurred_at.toISOString().slice(11, 23)
      })),
      traces: rows
    };
  }

  async listPolicyVersions(environmentId: string) {
    const rows = await this.client<
      {
        id: string;
        published_at: Date | null;
        rules: unknown;
        status: string;
        version: number;
      }[]
    >`
      SELECT id, version, status::text, rules, published_at
      FROM policy_versions
      WHERE environment_id = ${environmentId}
      ORDER BY version DESC
    `;
    return rows.map((row) => ({
      ...row,
      rules:
        typeof row.rules === "string"
          ? (JSON.parse(row.rules) as unknown)
          : row.rules
    }));
  }

  async listTraces(environmentId: string, query = "") {
    const search = `%${query}%`;
    return this.client<TraceProjectionRow[]>`
      SELECT
        id, amount_atomic::text, payer, resource_url, policy_outcome, network,
        transaction_hash, last_seen_at, metadata
      FROM traces
      WHERE environment_id = ${environmentId}
        AND (
          ${query} = '' OR id ILIKE ${search} OR COALESCE(payer, '') ILIKE ${search}
          OR COALESCE(resource_url, '') ILIKE ${search}
          OR COALESCE(transaction_hash, '') ILIKE ${search}
        )
      ORDER BY last_seen_at DESC
      LIMIT 200
    `;
  }

  async traceDetail(environmentId: string, traceId: string) {
    const traces = await this.client<TraceProjectionRow[]>`
      SELECT
        id, amount_atomic::text, payer, resource_url, policy_outcome, network,
        transaction_hash, last_seen_at, metadata
      FROM traces WHERE environment_id = ${environmentId} AND id = ${traceId} LIMIT 1
    `;
    const events = await this.client<
      { event_type: string; metadata: unknown; occurred_at: Date }[]
    >`
      SELECT event_type, metadata, occurred_at
      FROM trace_events WHERE environment_id = ${environmentId} AND trace_id = ${traceId}
      ORDER BY occurred_at
    `;
    return { events, trace: traces[0] };
  }

  async listWebhooks(environmentId: string) {
    return this.client<
      { enabled: boolean; event_types: string[]; id: string; url: string }[]
    >`
      SELECT id, url, event_types, enabled
      FROM webhooks WHERE environment_id = ${environmentId} ORDER BY created_at DESC
    `;
  }

  async listWebhookDeliveries(environmentId: string) {
    return this.client<
      {
        attempt: number;
        created_at: Date;
        event_type: string;
        id: string;
        last_error: string | null;
        status_code: number | null;
        url: string;
      }[]
    >`
      SELECT d.id, d.event_type, d.status_code, d.attempt, d.last_error,
        d.created_at, w.url
      FROM webhook_deliveries d
      JOIN webhooks w ON w.id = d.webhook_id
      WHERE w.environment_id = ${environmentId}
      ORDER BY d.created_at DESC LIMIT 100
    `;
  }

  async listAudit(organizationId: string) {
    return this.client<
      {
        action: string;
        actor: string | null;
        id: string;
        occurred_at: Date;
        target_type: string;
      }[]
    >`
      SELECT a.id, a.action, a.target_type, a.occurred_at, u.email AS actor
      FROM audit_entries a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.organization_id = ${organizationId}
      ORDER BY a.occurred_at DESC LIMIT 100
    `;
  }

  async eventsAfter(environmentId: string, after: Date) {
    return this.client<
      {
        event_id: string;
        event_type: string;
        occurred_at: Date;
        trace_id: string;
      }[]
    >`
      SELECT event_id, event_type, occurred_at, trace_id
      FROM trace_events
      WHERE environment_id = ${environmentId} AND occurred_at > ${after}
      ORDER BY occurred_at ASC LIMIT 100
    `;
  }

  async listTeam(organizationId: string) {
    return this.client<{ email: string; name: string; role: DashboardRole }[]>`
      SELECT u.email, u.name, m.role::text AS role
      FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ${organizationId}
      ORDER BY u.email
    `;
  }

  async listApiKeys(environmentId: string) {
    return this.client<
      {
        created_at: Date;
        id: string;
        last_used_at: Date | null;
        name: string;
        revoked_at: Date | null;
      }[]
    >`
      SELECT id, name, created_at, last_used_at, revoked_at
      FROM api_keys WHERE environment_id = ${environmentId} ORDER BY created_at DESC
    `;
  }

  async createProjectApiKey(
    environmentId: string,
    name: string,
    userId: string
  ) {
    const key = createApiKey();
    await this.client`
      INSERT INTO api_keys (environment_id, name, lookup, secret_hash, created_by)
      VALUES (${environmentId}, ${name}, ${key.lookup}, ${key.secretHash}, ${userId})
    `;
    return { token: key.token };
  }

  async revokeApiKey(environmentId: string, keyId: string): Promise<void> {
    await this.client`
      UPDATE api_keys SET revoked_at = now()
      WHERE id = ${keyId} AND environment_id = ${environmentId} AND revoked_at IS NULL
    `;
  }

  async createWebhook(
    environmentId: string,
    url: string,
    secretCiphertext: string,
    eventTypes: readonly string[]
  ): Promise<void> {
    await this.client`
      INSERT INTO webhooks (environment_id, url, secret_ciphertext, event_types)
      VALUES (${environmentId}, ${url}, ${secretCiphertext}, ${eventTypes})
    `;
  }

  async retryWebhookDelivery(
    environmentId: string,
    deliveryId: string
  ): Promise<void> {
    await this.client`
      UPDATE webhook_deliveries d SET next_attempt_at = now(), last_error = NULL
      FROM webhooks w
      WHERE d.id = ${deliveryId} AND d.webhook_id = w.id
        AND w.environment_id = ${environmentId} AND d.delivered_at IS NULL
    `;
  }

  async createInvitation(
    organizationId: string,
    email: string,
    role: DashboardRole,
    userId: string
  ) {
    const token = `qinv_${randomUUID()}_${randomUUID()}`;
    const rows = await this.client<{ id: string }[]>`
      INSERT INTO invitations (
        organization_id, email, role, token_hash, expires_at, created_by
      ) VALUES (
        ${organizationId}, ${email.toLowerCase()}, ${role},
        ${hashInvitationToken(token)}, now() + interval '7 days', ${userId}
      ) RETURNING id
    `;
    return { id: rows[0]?.id, token };
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
