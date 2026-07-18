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

export interface DashboardData {
  readonly metrics: readonly Metric[];
  readonly selectedTrace: TraceRow & {
    readonly network: string;
    readonly transaction: string;
  };
  readonly timeline: readonly TimelineEvent[];
  readonly traces: readonly TraceRow[];
}

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
