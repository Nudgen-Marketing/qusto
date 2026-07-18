import { describe, expect, it } from "vitest";

import { evaluatePolicies } from "../src/index.js";
import type { PaymentContext, PolicyRule } from "../src/index.js";

const payment: PaymentContext = {
  amountAtomic: "12500000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  network: "eip155:8453",
  payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  phase: "buyer",
  resourceUrl: "https://api.example.com/v1/data"
};

describe("evaluatePolicies", () => {
  it("allows when no rule rejects the payment", () => {
    expect(evaluatePolicies(payment, [])).toEqual({
      outcome: "allow",
      reasonCodes: []
    });
  });

  it("denies a payment above the maximum amount", () => {
    const rules: PolicyRule[] = [
      {
        id: "max-amount",
        kind: "max-amount",
        maxAmountAtomic: "10000000",
        phases: ["buyer"]
      }
    ];

    expect(evaluatePolicies(payment, rules)).toEqual({
      outcome: "deny",
      reasonCodes: ["MAX_AMOUNT_EXCEEDED"],
      ruleIds: ["max-amount"]
    });
  });

  it("enforces allowlists and denylists with deny precedence", () => {
    const rules: PolicyRule[] = [
      {
        dimension: "payee",
        id: "approved-payees",
        kind: "allowlist",
        phases: ["buyer"],
        values: [payment.payee]
      },
      {
        dimension: "resourceUrl",
        id: "blocked-resource",
        kind: "denylist",
        phases: ["buyer"],
        values: [payment.resourceUrl]
      }
    ];

    expect(evaluatePolicies(payment, rules)).toEqual({
      outcome: "deny",
      reasonCodes: ["DENYLIST_MATCH"],
      ruleIds: ["blocked-resource"]
    });
  });

  it("denies when rolling spend plus the payment exceeds the limit", () => {
    const rules: PolicyRule[] = [
      {
        id: "daily-budget",
        kind: "rolling-limit",
        maxAmountAtomic: "20000000",
        phases: ["buyer"],
        windowSeconds: 86_400
      }
    ];

    expect(
      evaluatePolicies(payment, rules, { rollingSpendAtomic: "10000000" })
    ).toEqual({
      outcome: "deny",
      reasonCodes: ["ROLLING_LIMIT_EXCEEDED"],
      ruleIds: ["daily-budget"]
    });
  });

  it("ignores rules scoped to the other integration phase", () => {
    const rules: PolicyRule[] = [
      {
        id: "seller-only",
        kind: "max-amount",
        maxAmountAtomic: "1",
        phases: ["seller"]
      }
    ];

    expect(evaluatePolicies(payment, rules).outcome).toBe("allow");
  });

  it("does not mutate the payment or rule inputs", () => {
    const rules: PolicyRule[] = [
      {
        dimension: "network",
        id: "base-only",
        kind: "allowlist",
        phases: ["buyer", "seller"],
        values: ["eip155:8453"]
      }
    ];
    const before = JSON.stringify({ payment, rules });

    evaluatePolicies(payment, rules);

    expect(JSON.stringify({ payment, rules })).toBe(before);
  });
});
