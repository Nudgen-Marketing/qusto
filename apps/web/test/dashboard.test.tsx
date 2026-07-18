import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Dashboard } from "../src/components/dashboard/dashboard";
import { demoDashboardData } from "../src/components/dashboard/demo-data";

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
});
