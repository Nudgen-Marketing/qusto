import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppFrame } from "../src/components/dashboard/app-frame";
import { GettingStartedGuide } from "../src/components/getting-started/getting-started-guide";

describe("Getting started guide", () => {
  it("renders the complete first-request workflow", () => {
    const html = renderToStaticMarkup(createElement(GettingStartedGuide));

    expect(html).toContain("Create an API key");
    expect(html).toContain("pnpm add @qusto/sdk");
    expect(html).toContain("@qusto/mcp");
    expect(html).toContain("Review your policy");
    expect(html).toContain("Verify the trace");
    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/policies"');
    expect(html).toContain('href="/traces"');
  });

  it("uses placeholders and explains how secrets are handled", () => {
    const html = renderToStaticMarkup(createElement(GettingStartedGuide));

    expect(html).toContain("process.env.QUSTO_API_KEY");
    expect(html).toContain("&lt;your-environment-api-key&gt;");
    expect(html).toContain("Wallet private keys stay in your local MCP process");
    expect(html).not.toMatch(/qsk_[A-Za-z0-9_-]{20,}/);
    expect(html).not.toMatch(/0x[a-fA-F0-9]{64}/);
  });

  it("marks Getting started as the current sidebar destination", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppFrame,
        {
          active: "Getting started",
          children: createElement(GettingStartedGuide),
          environment: "production",
          title: "Getting started"
        }
      )
    );

    expect(html).toContain('href="/getting-started"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Getting started");
  });
});
