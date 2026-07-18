export type IntegrationPhase = "buyer" | "seller";

export interface PaymentContext {
  readonly amountAtomic: string;
  readonly asset: string;
  readonly network: string;
  readonly payer: string;
  readonly payee: string;
  readonly phase: IntegrationPhase;
  readonly resourceUrl: string;
  readonly tool?: string;
}

interface RuleBase {
  readonly id: string;
  readonly phases: readonly IntegrationPhase[];
}

export interface MaxAmountRule extends RuleBase {
  readonly kind: "max-amount";
  readonly maxAmountAtomic: string;
}

export interface RollingLimitRule extends RuleBase {
  readonly kind: "rolling-limit";
  readonly maxAmountAtomic: string;
  readonly windowSeconds: 3_600 | 86_400 | 604_800 | 2_592_000;
}

export type ListDimension =
  "asset" | "network" | "payer" | "payee" | "resourceUrl" | "tool";

export interface ListRule extends RuleBase {
  readonly dimension: ListDimension;
  readonly kind: "allowlist" | "denylist";
  readonly values: readonly string[];
}

export type PolicyRule = MaxAmountRule | RollingLimitRule | ListRule;

export interface EvaluationFacts {
  readonly rollingSpendAtomic?: string;
}

export type PolicyReasonCode =
  | "ALLOWLIST_MISS"
  | "DENYLIST_MATCH"
  | "MAX_AMOUNT_EXCEEDED"
  | "ROLLING_LIMIT_EXCEEDED";

export interface PolicyDecision {
  readonly outcome: "allow" | "deny";
  readonly reasonCodes: readonly PolicyReasonCode[];
  readonly ruleIds?: readonly string[];
}
