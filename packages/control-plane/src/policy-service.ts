import { randomUUID } from "node:crypto";

import { evaluatePolicies } from "@qusto/policy-engine";
import type {
  IntegrationPhase,
  PolicyReasonCode,
  PolicyRule,
  RollingLimitRule
} from "@qusto/policy-engine";

export interface PolicyEvaluationInput {
  readonly amountAtomic: string;
  readonly asset: string;
  readonly environmentId: string;
  readonly idempotencyKey: string;
  readonly network: string;
  readonly payee: string;
  readonly payer: string;
  readonly phase: IntegrationPhase;
  readonly policyVersionId: string;
  readonly resourceUrl: string;
  readonly tool?: string;
  readonly traceId: string;
}

export interface PersistedDecision {
  readonly amountAtomic: string;
  readonly decisionId: string;
  readonly environmentId: string;
  readonly idempotencyKey: string;
  readonly outcome: "allow" | "deny";
  readonly policyVersionId: string;
  readonly reasonCodes: readonly PolicyReasonCode[];
  readonly reservationExpiresAt?: string;
  readonly reservationId?: string;
  readonly ruleIds?: readonly string[];
  readonly traceId: string;
}

export interface EvaluationRepository {
  findDecision(
    environmentId: string,
    idempotencyKey: string
  ): Promise<PersistedDecision | undefined>;
  getRollingSpend(
    environmentId: string,
    payer: string,
    asset: string,
    windowSeconds: number
  ): Promise<string>;
  saveDecision(decision: PersistedDecision): Promise<PersistedDecision>;
  withBudgetLock<T>(scope: string, operation: () => Promise<T>): Promise<T>;
}

interface EvaluationOptions {
  readonly now?: () => Date;
  readonly randomId?: () => string;
}

const reservationLifetimeMs = 60_000;

export async function evaluatePayment(
  input: PolicyEvaluationInput,
  rules: readonly PolicyRule[],
  repository: EvaluationRepository,
  options: EvaluationOptions = {}
): Promise<PersistedDecision> {
  const scope = `${input.environmentId}:${input.payer.toLowerCase()}:${input.asset.toLowerCase()}`;

  return repository.withBudgetLock(scope, async () => {
    const existing = await repository.findDecision(
      input.environmentId,
      input.idempotencyKey
    );
    if (existing !== undefined) return existing;

    const rollingRule = rules.find(
      (rule): rule is RollingLimitRule =>
        rule.kind === "rolling-limit" && rule.phases.includes(input.phase)
    );
    const rollingSpendAtomic =
      rollingRule === undefined
        ? "0"
        : await repository.getRollingSpend(
            input.environmentId,
            input.payer,
            input.asset,
            rollingRule.windowSeconds
          );
    const decision = evaluatePolicies(input, rules, { rollingSpendAtomic });
    const randomId = options.randomId ?? randomUUID;
    const now = (options.now ?? (() => new Date()))();
    const reservation =
      decision.outcome === "allow" &&
      input.phase === "buyer" &&
      rollingRule !== undefined
        ? {
            reservationExpiresAt: new Date(
              now.getTime() + reservationLifetimeMs
            ).toISOString(),
            reservationId: `res_${randomId()}`
          }
        : {};
    const ruleIds =
      decision.ruleIds === undefined ? {} : { ruleIds: decision.ruleIds };

    return repository.saveDecision({
      amountAtomic: input.amountAtomic,
      decisionId: `dec_${randomId()}`,
      environmentId: input.environmentId,
      idempotencyKey: input.idempotencyKey,
      outcome: decision.outcome,
      policyVersionId: input.policyVersionId,
      reasonCodes: decision.reasonCodes,
      ...reservation,
      ...ruleIds,
      traceId: input.traceId
    });
  });
}
