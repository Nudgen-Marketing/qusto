export interface Metric {
  readonly change: string;
  readonly changeTone: "danger" | "success";
  readonly label: string;
  readonly value: string;
}

export interface TraceRow {
  readonly amount: string;
  readonly id: string;
  readonly latency: string;
  readonly payer: string;
  readonly policy: string;
  readonly resource: string;
  readonly status: "ALLOW" | "DENY";
  readonly time: string;
}

export interface TimelineEvent {
  readonly duration: string;
  readonly label: string;
  readonly time: string;
}

export const spendRanges = ["1H", "6H", "24H", "7D", "30D"] as const;

export type SpendRange = (typeof spendRanges)[number];

export interface SpendPoint {
  readonly amountAtomic: string;
  readonly timestamp: string;
}

export type SpendTrend = Readonly<Record<SpendRange, readonly SpendPoint[]>>;

export interface PolicyHealthSummary {
  readonly error: number;
  readonly healthy: number;
  readonly total: number;
  readonly warning: number;
}

export interface DashboardData {
  readonly metrics: readonly Metric[];
  readonly policyHealth: PolicyHealthSummary;
  readonly selectedTrace: TraceRow & {
    readonly network: string;
    readonly transaction: string;
  };
  readonly spendTrend: SpendTrend;
  readonly timeline: readonly TimelineEvent[];
  readonly traces: readonly TraceRow[];
}

function demoPoints(
  start: string,
  stepMinutes: number,
  values: readonly number[]
): readonly SpendPoint[] {
  const startTime = new Date(start).getTime();
  return values.map((value, index) => ({
    amountAtomic: (BigInt(value) * 1_000_000n).toString(),
    timestamp: new Date(startTime + index * stepMinutes * 60_000).toISOString()
  }));
}

const demoSpendTrend: SpendTrend = {
  "1H": demoPoints(
    "2026-07-18T09:00:00.000Z",
    5,
    [18, 26, 24, 34, 31, 42, 49, 45, 57, 62, 68, 74]
  ),
  "6H": demoPoints(
    "2026-07-18T04:00:00.000Z",
    30,
    [95, 108, 101, 124, 139, 132, 151, 168, 159, 182, 196, 213]
  ),
  "24H": demoPoints(
    "2026-07-17T10:00:00.000Z",
    60,
    [
      180, 260, 225, 340, 310, 430, 475, 540, 510, 650, 735, 680, 790, 850, 670,
      560, 520, 710, 820, 930, 1080, 1150, 1110, 1230
    ]
  ),
  "7D": demoPoints(
    "2026-07-11T12:00:00.000Z",
    360,
    [
      420, 515, 470, 610, 690, 640, 760, 845, 790, 920, 980, 870, 1010, 1120,
      1080, 1190, 1260, 1180, 1320, 1410, 1360, 1490, 1550, 1470, 1620, 1710,
      1680, 1820
    ]
  ),
  "30D": demoPoints(
    "2026-06-18T00:00:00.000Z",
    1_440,
    [
      920, 1040, 980, 1160, 1230, 1190, 1310, 1420, 1360, 1510, 1590, 1480,
      1640, 1720, 1680, 1810, 1930, 1860, 2040, 2170, 2090, 2250, 2380, 2290,
      2460, 2540, 2490, 2670, 2810, 2950
    ]
  )
};

export const demoDashboardData: DashboardData = {
  metrics: [
    {
      change: "↑ 12.4%",
      changeTone: "success",
      label: "Total spend",
      value: "12,842.63 USDC"
    },
    {
      change: "↑ 8.7%",
      changeTone: "success",
      label: "Payments",
      value: "1,247"
    },
    {
      change: "↑ 15.0%",
      changeTone: "danger",
      label: "Denied",
      value: "23"
    },
    {
      change: "↓ 11.3%",
      changeTone: "success",
      label: "P95 decision",
      value: "184 ms"
    }
  ],
  policyHealth: { error: 2, healthy: 40, total: 48, warning: 6 },
  selectedTrace: {
    amount: "12.4500 USDC",
    id: "trace-1",
    latency: "142 ms",
    network: "Base",
    payer: "0x8f3a...7b12",
    policy: "markets-read",
    resource: "GET /v1/data/markets",
    status: "ALLOW",
    time: "10:21:33",
    transaction: "0x6a7f...e9c2d4b1"
  },
  spendTrend: demoSpendTrend,
  timeline: [
    { duration: "12 ms", label: "Payment required", time: "10:21:33.120" },
    { duration: "46 ms", label: "Policy allowed", time: "10:21:33.178" },
    { duration: "63 ms", label: "Payload signed", time: "10:21:33.262" },
    { duration: "142 ms", label: "Settlement confirmed", time: "10:21:33.404" }
  ],
  traces: [
    {
      amount: "12.4500 USDC",
      id: "trace-1",
      latency: "142 ms",
      payer: "0x8f3a...7b12",
      policy: "markets-read",
      resource: "GET /v1/data/markets",
      status: "ALLOW",
      time: "10:21:33"
    },
    {
      amount: "45.0000 USDC",
      id: "trace-2",
      latency: "168 ms",
      payer: "0x7c21...4a9d",
      policy: "compute-standard",
      resource: "POST /v1/compute",
      status: "ALLOW",
      time: "10:21:21"
    },
    {
      amount: "120.0000 USDC",
      id: "trace-3",
      latency: "96 ms",
      payer: "0x1d77...aa90",
      policy: "compute-standard",
      resource: "POST /v1/compute",
      status: "DENY",
      time: "10:21:05"
    },
    {
      amount: "2.5000 USDC",
      id: "trace-4",
      latency: "131 ms",
      payer: "0x9b12...cd34",
      policy: "prices-read",
      resource: "GET /v1/data/prices",
      status: "ALLOW",
      time: "10:20:58"
    },
    {
      amount: "12.4500 USDC",
      id: "trace-5",
      latency: "149 ms",
      payer: "0x3e91...bb22",
      policy: "markets-read",
      resource: "GET /v1/data/markets",
      status: "ALLOW",
      time: "10:20:44"
    },
    {
      amount: "200.0000 USDC",
      id: "trace-6",
      latency: "87 ms",
      payer: "0x5a33...ee11",
      policy: "compute-standard",
      resource: "POST /v1/compute",
      status: "DENY",
      time: "10:20:31"
    },
    {
      amount: "12.4500 USDC",
      id: "trace-7",
      latency: "141 ms",
      payer: "0x8f3a...7b12",
      policy: "markets-read",
      resource: "GET /v1/data/markets",
      status: "ALLOW",
      time: "10:20:22"
    }
  ]
};
