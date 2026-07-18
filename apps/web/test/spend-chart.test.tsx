import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildSpendChartModel,
  niceAtomicMaximum,
  SpendChart
} from "../src/components/dashboard/spend-chart";

const ranges = {
  "1H": [
    { amountAtomic: "1000000", timestamp: "2026-07-18T09:00:00.000Z" },
    { amountAtomic: "2000000", timestamp: "2026-07-18T09:05:00.000Z" }
  ],
  "6H": [{ amountAtomic: "3000000", timestamp: "2026-07-18T04:00:00.000Z" }],
  "24H": [
    { amountAtomic: "4000000", timestamp: "2026-07-17T10:00:00.000Z" },
    { amountAtomic: "6000000", timestamp: "2026-07-17T11:00:00.000Z" }
  ],
  "7D": [{ amountAtomic: "7000000", timestamp: "2026-07-11T10:00:00.000Z" }],
  "30D": [{ amountAtomic: "8000000", timestamp: "2026-06-18T10:00:00.000Z" }]
} as const;

function expectFinitePathWithinBounds(
  path: string | undefined,
  width: number,
  height: number
) {
  expect(path).toBeTruthy();
  expect(path).not.toMatch(/NaN|Infinity/);
  const coordinates = path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  expect(coordinates.length).toBeGreaterThanOrEqual(2);
  for (let index = 0; index < coordinates.length; index += 2) {
    expect(coordinates[index]).toBeGreaterThanOrEqual(0);
    expect(coordinates[index]).toBeLessThanOrEqual(width);
    expect(coordinates[index + 1]).toBeGreaterThanOrEqual(0);
    expect(coordinates[index + 1]).toBeLessThanOrEqual(height);
  }
}

describe("spend chart model", () => {
  it("rounds atomic maxima to a 1/2/5 scale without Number conversion", () => {
    expect(niceAtomicMaximum(1n)).toBe(1n);
    expect(niceAtomicMaximum(2n)).toBe(2n);
    expect(niceAtomicMaximum(3n)).toBe(5n);
    expect(niceAtomicMaximum(11n)).toBe(20n);
    expect(niceAtomicMaximum(5_000_001n)).toBe(10_000_000n);
    expect(niceAtomicMaximum(BigInt("9".repeat(78)))).toBe(10n ** 78n);
  });

  it("omits the fabricated line for empty and all-zero series", () => {
    const empty = buildSpendChartModel([], { height: 130, width: 600 });
    const zero = buildSpendChartModel(
      [
        { amountAtomic: "0", timestamp: "2026-07-18T09:00:00.000Z" },
        { amountAtomic: "0", timestamp: "2026-07-18T09:05:00.000Z" }
      ],
      { height: 130, width: 600 }
    );

    expect(empty).toMatchObject({ empty: true });
    expect(empty.path).toBeUndefined();
    expect(zero).toMatchObject({ empty: true });
    expect(zero.path).toBeUndefined();
  });

  it.each([
    {
      label: "single point",
      points: [
        { amountAtomic: "1000000", timestamp: "2026-07-18T09:00:00.000Z" }
      ]
    },
    {
      label: "flat values",
      points: [
        { amountAtomic: "5000000", timestamp: "2026-07-18T09:00:00.000Z" },
        { amountAtomic: "5000000", timestamp: "2026-07-18T09:05:00.000Z" }
      ]
    },
    {
      label: "sparse values",
      points: [
        { amountAtomic: "0", timestamp: "2026-07-18T09:00:00.000Z" },
        { amountAtomic: "9000000", timestamp: "2026-07-18T09:05:00.000Z" },
        { amountAtomic: "0", timestamp: "2026-07-18T09:10:00.000Z" }
      ]
    },
    {
      label: "numeric(78) values",
      points: [
        { amountAtomic: "1", timestamp: "2026-07-18T09:00:00.000Z" },
        {
          amountAtomic: "9".repeat(78),
          timestamp: "2026-07-18T09:05:00.000Z"
        }
      ]
    }
  ])("builds bounded finite geometry for $label", ({ points }) => {
    const model = buildSpendChartModel(points, { height: 130, width: 600 });

    expect(model.empty).toBe(false);
    expect(model.ticks).toHaveLength(5);
    expect(model.maximumAtomic).toBeGreaterThan(0n);
    expectFinitePathWithinBounds(model.path, 600, 130);
  });
});

describe("SpendChart", () => {
  it("starts at 24H with accessible selected state and summary", () => {
    const html = renderToStaticMarkup(
      createElement(SpendChart, { series: ranges })
    );

    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>24H<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>1H<\/button>/);
    expect(html).toMatch(/aria-label="[^"]*24 hours[^"]*"/i);
    expect(html).toContain("USDC");
  });

  it("announces an all-zero series instead of rendering a line", () => {
    const zero = Object.fromEntries(
      Object.keys(ranges).map((range) => [
        range,
        [{ amountAtomic: "0", timestamp: "2026-07-18T09:00:00.000Z" }]
      ])
    ) as unknown as typeof ranges;
    const html = renderToStaticMarkup(
      createElement(SpendChart, { series: zero })
    );

    expect(html).toContain("No settled USDC spend");
    expect(html).not.toContain('class="chart-line"');
  });
});
