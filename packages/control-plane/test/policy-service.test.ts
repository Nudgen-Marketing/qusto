import { describe, expect, it } from "vitest";

import { evaluatePayment } from "../src/index.js";
import type {
  EvaluationRepository,
  PersistedDecision,
  PolicyEvaluationInput
} from "../src/index.js";
import type { PolicyRule } from "@qusto/policy-engine";

const input: PolicyEvaluationInput = {
  amountAtomic: "12500000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  environmentId: "env_prod",
  idempotencyKey: "pay_01JZ9M7ENM8WD8CQXT6BC44GYR",
  network: "eip155:8453",
  payee: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  phase: "buyer",
  policyVersionId: "pv_1",
  resourceUrl: "https://api.example.com/v1/data",
  traceId: "01JZ9M7ENM8WD8CQXT6BC44GYQ"
};

class MemoryEvaluationRepository implements EvaluationRepository {
  readonly decisions = new Map<string, PersistedDecision>();
  reservations = 0;
  rollingSpendAtomic = "0";

  async findDecision(_environmentId: string, idempotencyKey: string) {
    return this.decisions.get(idempotencyKey);
  }

  async getRollingSpend() {
    return this.rollingSpendAtomic;
  }

  async saveDecision(decision: PersistedDecision) {
    this.decisions.set(decision.idempotencyKey, decision);
    if (decision.reservationId !== undefined) this.reservations += 1;
    return decision;
  }

  async withBudgetLock<T>(_scope: string, operation: () => Promise<T>) {
    return operation();
  }
}

describe("evaluatePayment", () => {
  it("returns the original decision for an idempotent retry", async () => {
    const repository = new MemoryEvaluationRepository();
    const rules: PolicyRule[] = [];

    const first = await evaluatePayment(input, rules, repository, {
      now: () => new Date(0)
    });
    const second = await evaluatePayment(input, rules, repository, {
      now: () => new Date(1000)
    });

    expect(second).toEqual(first);
    expect(repository.decisions).toHaveLength(1);
  });

  it("creates one expiring reservation for an allowed buyer rolling-limit decision", async () => {
    const repository = new MemoryEvaluationRepository();
    const rules: PolicyRule[] = [
      {
        id: "daily-budget",
        kind: "rolling-limit",
        maxAmountAtomic: "20000000",
        phases: ["buyer"],
        windowSeconds: 86_400
      }
    ];

    const result = await evaluatePayment(input, rules, repository, {
      now: () => new Date(0)
    });

    expect(result.outcome).toBe("allow");
    expect(result.reservationId).toMatch(/^res_/);
    expect(result.reservationExpiresAt).toBe("1970-01-01T00:01:00.000Z");
    expect(repository.reservations).toBe(1);
  });

  it("denies without reserving when rolling spend exceeds the limit", async () => {
    const repository = new MemoryEvaluationRepository();
    repository.rollingSpendAtomic = "10000000";
    const rules: PolicyRule[] = [
      {
        id: "daily-budget",
        kind: "rolling-limit",
        maxAmountAtomic: "20000000",
        phases: ["buyer"],
        windowSeconds: 86_400
      }
    ];

    const result = await evaluatePayment(input, rules, repository);

    expect(result).toMatchObject({
      outcome: "deny",
      reasonCodes: ["ROLLING_LIMIT_EXCEEDED"]
    });
    expect(repository.reservations).toBe(0);
  });

  it("does not create spend reservations for seller decisions", async () => {
    const repository = new MemoryEvaluationRepository();

    const result = await evaluatePayment(
      { ...input, phase: "seller" },
      [],
      repository
    );

    expect(result.outcome).toBe("allow");
    expect(result.reservationId).toBeUndefined();
  });
});
