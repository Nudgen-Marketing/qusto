import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { resolveBaseNetwork } from "@qusto/contracts";

import { migrateDatabase } from "@qusto/database";
import {
  PostgresDashboardRepository,
  type DashboardContext
} from "../src/server/dashboard-repository";
import {
  createTestDatabase,
  type TestDatabase
} from "../../../packages/database/test/helpers";

const baseUsdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const baseSepoliaUsdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const now = new Date("2026-07-18T10:02:00.000Z");

describe("PostgresDashboardRepository overview charts", () => {
  let context: DashboardContext;
  let database: TestDatabase;
  let repository: PostgresDashboardRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
    await migrateDatabase(database.url);
    const sql = postgres(database.url, { max: 1 });

    const [organization] = await sql<{ id: string }[]>`
      INSERT INTO organizations (name) VALUES ('Dashboard tests') RETURNING id
    `;
    if (organization === undefined)
      throw new Error("Organization setup failed");
    const [project] = await sql<{ id: string }[]>`
      INSERT INTO projects (organization_id, name, slug)
      VALUES (${organization.id}, 'Payments', 'payments') RETURNING id
    `;
    if (project === undefined) throw new Error("Project setup failed");
    const environments = await sql<{ id: string; name: string }[]>`
      INSERT INTO environments (project_id, name, fail_mode)
      VALUES
        (${project.id}, 'production', 'closed'),
        (${project.id}, 'staging', 'closed')
      RETURNING id, name::text
    `;
    const productionId = environments.find(
      ({ name }) => name === "production"
    )?.id;
    const stagingId = environments.find(({ name }) => name === "staging")?.id;
    if (productionId === undefined || stagingId === undefined) {
      throw new Error("Dashboard test setup failed");
    }

    context = {
      environmentId: productionId,
      environmentName: "production",
      organizationId: organization.id,
      projectId: project.id,
      projectName: "Payments",
      role: "admin"
    };

    const validRules = [
      {
        id: "max-spend",
        kind: "max-amount",
        maxAmountAtomic: "10000000",
        phases: ["buyer"]
      }
    ];
    await sql`
      INSERT INTO policy_versions (environment_id, version, status, rules)
      VALUES
        (${productionId}, 1, 'published', ${sql.json(validRules)}::jsonb),
        (${productionId}, 2, 'archived', ${sql.json(validRules)}::jsonb),
        (${productionId}, 3, 'draft', ${sql.json(validRules)}::jsonb),
        (${productionId}, 4, 'published', '{"broken":true}'::jsonb),
        (${productionId}, 5, 'published', to_jsonb(${JSON.stringify(validRules)}::text)),
        (${productionId}, 6, 'published', to_jsonb('not-json'::text)),
        (${stagingId}, 1, 'published', ${sql.json(validRules)}::jsonb)
    `;

    const traces = [
      [
        "settled-current",
        productionId,
        "settled",
        "eip155:8453",
        baseUsdc,
        "1000000",
        -10
      ],
      [
        "finalized-prior",
        productionId,
        "finalized",
        "eip155:8453",
        baseUsdc.toUpperCase(),
        "2500000",
        -70
      ],
      [
        "window-start",
        productionId,
        "settled",
        "eip155:8453",
        baseUsdc,
        "5000000",
        -1_440
      ],
      [
        "excluded-testnet",
        productionId,
        "settled",
        "eip155:84532",
        baseSepoliaUsdc,
        "7000000",
        -15
      ],
      [
        "excluded-asset",
        productionId,
        "settled",
        "eip155:8453",
        "0x0000000000000000000000000000000000000001",
        "9000000",
        -20
      ],
      [
        "excluded-failed",
        productionId,
        "failed",
        "eip155:8453",
        baseUsdc,
        "11000000",
        -25
      ],
      [
        "excluded-end",
        productionId,
        "settled",
        "eip155:8453",
        baseUsdc,
        "13000000",
        0
      ],
      [
        "excluded-environment",
        stagingId,
        "settled",
        "eip155:8453",
        baseUsdc,
        "17000000",
        -5
      ]
    ] as const;

    for (const [
      id,
      environmentId,
      status,
      network,
      asset,
      amount,
      minutes
    ] of traces) {
      const timestamp = new Date(now.getTime() + minutes * 60_000);
      await sql`
        INSERT INTO traces (
          id, environment_id, status, last_event_type, network, asset,
          amount_atomic, first_seen_at, last_seen_at
        ) VALUES (
          ${id}, ${environmentId}, ${status}, 'settlement.succeeded', ${network},
          ${asset}, ${amount}, ${timestamp}, ${timestamp}
        )
      `;
    }

    await sql.end();
    repository = new PostgresDashboardRepository(database.url);
  });

  afterAll(async () => {
    await repository.close();
    await database.close();
  });

  it("returns isolated Base-USDC spend buckets and real policy health", async () => {
    const overview = await repository.overview(context, now);

    expect(overview.metrics[0]?.value).toBe("8.5000 USDC");
    expect(overview.policyHealth).toEqual({
      error: 3,
      healthy: 2,
      total: 6,
      warning: 1
    });
    expect(overview.spendTrend["1H"]).toHaveLength(12);
    expect(overview.spendTrend["24H"]).toHaveLength(24);
    expect(
      overview.spendTrend["24H"].reduce(
        (total, point) => total + BigInt(point.amountAtomic),
        0n
      )
    ).toBe(8_500_000n);
    expect(
      overview.spendTrend["24H"].every(
        (point, index, points) =>
          index === 0 || point.timestamp > (points[index - 1]?.timestamp ?? "")
      )
    ).toBe(true);
    expect(
      overview.spendTrend["24H"].some(
        ({ amountAtomic }) => amountAtomic === "0"
      )
    ).toBe(true);
  });

  it("uses the configured Base Sepolia network and USDC asset", async () => {
    const sepoliaRepository = new PostgresDashboardRepository(
      database.url,
      resolveBaseNetwork("base-sepolia")
    );
    try {
      const overview = await sepoliaRepository.overview(context, now);
      expect(overview.metrics[0]?.value).toBe("7.0000 USDC");
      expect(
        overview.spendTrend["24H"].reduce(
          (total, point) => total + BigInt(point.amountAtomic),
          0n
        )
      ).toBe(7_000_000n);
    } finally {
      await sepoliaRepository.close();
    }
  });
});
