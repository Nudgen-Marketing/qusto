import type {
  EvaluationFacts,
  ListDimension,
  PaymentContext,
  PolicyDecision,
  PolicyReasonCode,
  PolicyRule
} from "./types.js";

interface Rejection {
  readonly reasonCode: PolicyReasonCode;
  readonly ruleId: string;
}

const addressDimensions = new Set<ListDimension>(["asset", "payer", "payee"]);

function normalizedValue(dimension: ListDimension, value: string): string {
  return addressDimensions.has(dimension) ? value.toLowerCase() : value;
}

function paymentValue(payment: PaymentContext, dimension: ListDimension): string {
  return payment[dimension] ?? "";
}

function matchesList(payment: PaymentContext, rule: Extract<PolicyRule, { kind: "allowlist" | "denylist" }>): boolean {
  const value = normalizedValue(rule.dimension, paymentValue(payment, rule.dimension));

  return rule.values.some((candidate) => normalizedValue(rule.dimension, candidate) === value);
}

function rejectionForRule(
  payment: PaymentContext,
  rule: PolicyRule,
  facts: EvaluationFacts
): Rejection | undefined {
  if (!rule.phases.includes(payment.phase)) {
    return undefined;
  }

  if (rule.kind === "max-amount") {
    return BigInt(payment.amountAtomic) > BigInt(rule.maxAmountAtomic)
      ? { reasonCode: "MAX_AMOUNT_EXCEEDED", ruleId: rule.id }
      : undefined;
  }

  if (rule.kind === "rolling-limit") {
    const rollingSpend = BigInt(facts.rollingSpendAtomic ?? "0");
    const projectedSpend = rollingSpend + BigInt(payment.amountAtomic);

    return projectedSpend > BigInt(rule.maxAmountAtomic)
      ? { reasonCode: "ROLLING_LIMIT_EXCEEDED", ruleId: rule.id }
      : undefined;
  }

  const matches = matchesList(payment, rule);

  if (rule.kind === "denylist" && matches) {
    return { reasonCode: "DENYLIST_MATCH", ruleId: rule.id };
  }

  if (rule.kind === "allowlist" && !matches) {
    return { reasonCode: "ALLOWLIST_MISS", ruleId: rule.id };
  }

  return undefined;
}

export function evaluatePolicies(
  payment: PaymentContext,
  rules: readonly PolicyRule[],
  facts: EvaluationFacts = {}
): PolicyDecision {
  const rejections = rules
    .map((rule) => rejectionForRule(payment, rule, facts))
    .filter((rejection): rejection is Rejection => rejection !== undefined);

  const denylistRejections = rejections.filter(
    ({ reasonCode }) => reasonCode === "DENYLIST_MATCH"
  );
  const decisiveRejections = denylistRejections.length > 0 ? denylistRejections : rejections;

  if (decisiveRejections.length === 0) {
    return { outcome: "allow", reasonCodes: [] };
  }

  return {
    outcome: "deny",
    reasonCodes: decisiveRejections.map(({ reasonCode }) => reasonCode),
    ruleIds: decisiveRejections.map(({ ruleId }) => ruleId)
  };
}
