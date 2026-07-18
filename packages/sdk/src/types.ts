import type { CanonicalPaymentRequirement } from "@qusto/contracts";

export type QustoEnvironment = "development" | "production" | "staging";
export type FailureMode = "open" | "closed";

export interface QustoConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly environment: QustoEnvironment;
  readonly evaluationTimeoutMs?: number;
  readonly failureMode?: FailureMode;
  readonly fetch?: typeof fetch;
}

export interface EvaluationInput {
  readonly amountAtomic: string;
  readonly asset: string;
  readonly idempotencyKey?: string;
  readonly network: "eip155:8453" | "eip155:84532";
  readonly payee: string;
  readonly payer: string;
  readonly phase: "buyer" | "seller";
  readonly protocolVersion: 1 | 2;
  readonly resourceUrl: string;
  readonly scheme: "exact";
  readonly tool?: string;
  readonly traceId?: string;
}

export interface QustoDecision {
  readonly decisionId: string;
  readonly outcome: "allow" | "deny";
  readonly reasonCodes: readonly string[];
  readonly reservationExpiresAt?: string;
  readonly reservationId?: string;
  readonly traceId: string;
}

export interface X402Signer {
  readonly address?: string;
  createPaymentPayload(input: {
    readonly protocolVersion: 1 | 2;
    readonly requirement: CanonicalPaymentRequirement;
    readonly resourceUrl: string;
    readonly traceId: string;
  }): Promise<string>;
}

export interface GovernedFetchOptions {
  readonly signer: X402Signer;
  readonly tool?: string;
  readonly transport?: typeof fetch;
}
