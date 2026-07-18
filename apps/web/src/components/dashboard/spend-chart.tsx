"use client";

import { useState } from "react";

import {
  spendRanges,
  type SpendPoint,
  type SpendRange,
  type SpendTrend
} from "./demo-data";

interface ChartTick {
  readonly amountAtomic: bigint;
  readonly y: number;
}

export interface SpendChartModel {
  readonly empty: boolean;
  readonly maximumAtomic: bigint;
  readonly path?: string;
  readonly ticks: readonly ChartTick[];
}

const rangeDescriptions: Readonly<Record<SpendRange, string>> = {
  "1H": "1 hour",
  "6H": "6 hours",
  "24H": "24 hours",
  "7D": "7 days",
  "30D": "30 days"
};

function atomicValue(value: string): bigint {
  return /^(0|[1-9]\d*)$/.test(value) ? BigInt(value) : 0n;
}

export function niceAtomicMaximum(value: bigint): bigint {
  if (value <= 0n) return 0n;
  const power = 10n ** BigInt(value.toString().length - 1);
  if (value <= power) return power;
  if (value <= power * 2n) return power * 2n;
  if (value <= power * 5n) return power * 5n;
  return power * 10n;
}

function coordinate(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function buildSpendChartModel(
  points: readonly SpendPoint[],
  dimensions: { readonly height: number; readonly width: number }
): SpendChartModel {
  const amounts = points.map(({ amountAtomic }) => atomicValue(amountAtomic));
  const maximumAtomic = niceAtomicMaximum(
    amounts.reduce(
      (maximum, amount) => (amount > maximum ? amount : maximum),
      0n
    )
  );
  const ticks = Array.from({ length: 5 }, (_, index): ChartTick => ({
    amountAtomic: (maximumAtomic * BigInt(4 - index)) / 4n,
    y: (dimensions.height * index) / 4
  }));

  if (points.length === 0 || maximumAtomic === 0n) {
    return { empty: true, maximumAtomic, ticks };
  }

  const path = amounts
    .map((amount, index) => {
      const x =
        points.length === 1
          ? dimensions.width / 2
          : (dimensions.width * index) / (points.length - 1);
      const scaled = Number((amount * 1_000_000n) / maximumAtomic) / 1_000_000;
      const y = dimensions.height - scaled * dimensions.height;
      return `${index === 0 ? "M" : "L"}${coordinate(x)},${coordinate(y)}`;
    })
    .join(" ");

  return { empty: false, maximumAtomic, path, ticks };
}

function formatAtomicUsdc(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  const formattedWhole = new Intl.NumberFormat("en-US").format(whole);
  return fraction.length === 0
    ? formattedWhole
    : `${formattedWhole}.${fraction}`;
}

function axisLabel(point: SpendPoint, range: SpendRange): string {
  const date = new Date(point.timestamp);
  return range === "7D" || range === "30D"
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        timeZone: "UTC"
      }).format(date)
    : new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        timeZone: "UTC"
      }).format(date);
}

function axisPoints(points: readonly SpendPoint[]): readonly SpendPoint[] {
  if (points.length <= 7) return points;
  const indices = new Set<number>();
  for (let index = 0; index < 7; index += 1) {
    indices.add(Math.round((index * (points.length - 1)) / 6));
  }
  return [...indices].flatMap((index) => {
    const point = points[index];
    return point === undefined ? [] : [point];
  });
}

export function SpendChart({ series }: { readonly series: SpendTrend }) {
  const [range, setRange] = useState<SpendRange>("24H");
  const points = series[range];
  const model = buildSpendChartModel(points, { height: 104, width: 536 });
  const totalAtomic = points.reduce(
    (total, point) => total + atomicValue(point.amountAtomic),
    0n
  );
  const description = rangeDescriptions[range];
  const summary = `USDC spend for the last ${description}: ${formatAtomicUsdc(totalAtomic)} USDC total`;
  const labels = axisPoints(points);

  return (
    <section className="chart-panel">
      <header>
        <strong>Spend trend (USDC)</strong>
        <nav aria-label="Spend trend range">
          {spendRanges.map((item) => (
            <button
              aria-pressed={item === range}
              className={item === range ? "text-active" : undefined}
              key={item}
              onClick={() => setRange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </header>
      <svg aria-label={summary} role="img" viewBox="0 0 600 124">
        <g className="chart-grid">
          {model.ticks.map((tick) => (
            <line
              key={`${tick.amountAtomic.toString()}-${String(tick.y)}`}
              x1="52"
              x2="588"
              y1={8 + tick.y}
              y2={8 + tick.y}
            />
          ))}
        </g>
        <g className="chart-y-axis">
          {model.ticks.map((tick) => (
            <text
              key={`${tick.amountAtomic.toString()}-${String(tick.y)}`}
              x="44"
              y={11 + tick.y}
            >
              {formatAtomicUsdc(tick.amountAtomic)}
            </text>
          ))}
        </g>
        {model.empty ? (
          <text className="chart-empty" x="320" y="62">
            No settled USDC spend
          </text>
        ) : (
          <path
            className="chart-line"
            d={model.path}
            transform="translate(52 8)"
          />
        )}
      </svg>
      <div className="chart-axis" style={{ paddingLeft: 52, paddingRight: 12 }}>
        {labels.map((point, index) => (
          <span key={`${point.timestamp}-${String(index)}`}>
            {axisLabel(point, range)}
          </span>
        ))}
      </div>
      <div className="chart-legend">
        <span aria-hidden="true" /> USDC spend
      </div>
    </section>
  );
}
