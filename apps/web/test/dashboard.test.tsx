import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Dashboard } from "../src/components/dashboard/dashboard";
import { demoDashboardData } from "../src/components/dashboard/demo-data";

const emptySpendTrend = {
  "1H": [],
  "6H": [],
  "24H": [],
  "7D": [],
  "30D": []
} as const;

describe("Dashboard", () => {
  it("renders the primary governance workflow from the accepted concept", () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, { data: demoDashboardData })
    );

    expect(html).toContain("Payment governance");
    expect(html).toContain("Live payment traces");
    expect(html).toContain("Trace timeline");
    expect(html).toContain("Policy coverage");
    expect(html).toContain("Create policy");
    expect(html).toContain("Settlement confirmed");
    expect(html).toContain('href="/getting-started"');
    expect(html).toContain("Getting started");
  });

  it("uses a table for traces rather than a grid of cards", () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, { data: demoDashboardData })
    );

    expect(html).toContain("<table");
    expect(html).toContain("Status");
    expect(html).toContain("Resource");
    expect(html).toContain("Latency");
  });

  it("renders supplied policy-health counts and percentages", () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        data: {
          ...demoDashboardData,
          policyHealth: { error: 0, healthy: 3, total: 4, warning: 1 },
          spendTrend: emptySpendTrend
        }
      })
    );

    expect(html).toContain("Healthy policies");
    expect(html).toContain("3 <small>75.0%</small>");
    expect(html).toContain("1 <small>25.0%</small>");
    expect(html).toContain("0 <small>0.0%</small>");
    expect(html).toContain("<dt>Total policies</dt><dd>4</dd>");
  });

  it("renders zero policy percentages without dividing by zero", () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        data: {
          ...demoDashboardData,
          policyHealth: { error: 0, healthy: 0, total: 0, warning: 0 },
          spendTrend: emptySpendTrend
        }
      })
    );

    expect(html.match(/0\.0%/g)).toHaveLength(3);
    expect(html).not.toContain("NaN%");
    expect(html).not.toContain("Infinity%");
    expect(html).toContain("<dt>Total policies</dt><dd>0</dd>");
  });
});
