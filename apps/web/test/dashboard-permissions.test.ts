import { describe, expect, it } from "vitest";

import {
  assertDashboardPermission,
  parseEventTypes,
  parsePolicyRules
} from "../src/server/dashboard-permissions";

describe("dashboard management permissions", () => {
  it("allows only admins to manage team members", () => {
    expect(() =>
      assertDashboardPermission("admin", "team:write")
    ).not.toThrow();
    expect(() => assertDashboardPermission("developer", "team:write")).toThrow(
      "Administrator access required"
    );
    expect(() => assertDashboardPermission("viewer", "team:write")).toThrow(
      "Administrator access required"
    );
  });

  it("allows developers to manage policies but keeps viewers read-only", () => {
    expect(() =>
      assertDashboardPermission("developer", "policy:write")
    ).not.toThrow();
    expect(() => assertDashboardPermission("viewer", "policy:write")).toThrow(
      "Write access required"
    );
  });

  it("accepts only supported webhook event types", () => {
    expect(parseEventTypes("policy.denied, chain.reverted")).toEqual([
      "policy.denied",
      "chain.reverted"
    ]);
    expect(() => parseEventTypes("payment.required")).toThrow(
      "Unsupported webhook event"
    );
  });

  it("validates policy JSON at the dashboard boundary", () => {
    expect(
      parsePolicyRules(
        JSON.stringify([
          {
            id: "max-10-usdc",
            kind: "max-amount",
            maxAmountAtomic: "10000000",
            phases: ["buyer", "seller"]
          }
        ])
      )
    ).toHaveLength(1);
    expect(() => parsePolicyRules('{"kind":"max-amount"}')).toThrow(
      "Policy rules must be an array"
    );
    expect(() =>
      parsePolicyRules(
        '[{"id":"x","kind":"max-amount","maxAmountAtomic":"-1","phases":["buyer"]}]'
      )
    ).toThrow("Invalid policy rules");
  });
});
