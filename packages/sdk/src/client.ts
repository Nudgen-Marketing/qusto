import { randomUUID } from "node:crypto";

import { normalizePaymentRequired } from "@qusto/contracts";
import type { PublicTraceEvent } from "@qusto/contracts";

import { PolicyDeniedError } from "./errors.js";
import type {
  EvaluationInput,
  GovernedFetchOptions,
  QustoConfig,
  QustoDecision
} from "./types.js";

const zeroAddress = "0x0000000000000000000000000000000000000000";

function identifier(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function apiUrl(baseUrl: string, path: string): string {
  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Qusto baseUrl must use HTTP(S)");
  }
  return url.toString();
}

function parseDecision(value: unknown, traceId: string): QustoDecision {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null
  ) {
    throw new Error("Invalid Qusto decision response");
  }
  const data = value.data;
  if (
    !("decisionId" in data) ||
    typeof data.decisionId !== "string" ||
    !("outcome" in data) ||
    (data.outcome !== "allow" && data.outcome !== "deny") ||
    !("reasonCodes" in data) ||
    !Array.isArray(data.reasonCodes) ||
    !data.reasonCodes.every((code) => typeof code === "string")
  ) {
    throw new Error("Invalid Qusto decision response");
  }
  return {
    decisionId: data.decisionId,
    outcome: data.outcome,
    reasonCodes: [...data.reasonCodes],
    ...("reservationExpiresAt" in data &&
    typeof data.reservationExpiresAt === "string"
      ? { reservationExpiresAt: data.reservationExpiresAt }
      : {}),
    ...("reservationId" in data && typeof data.reservationId === "string"
      ? { reservationId: data.reservationId }
      : {}),
    traceId
  };
}

async function paymentRequiredFromResponse(
  response: Response
): Promise<unknown> {
  const header = response.headers.get("payment-required");
  if (header !== null) {
    try {
      return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    } catch {
      throw new Error("Malformed PAYMENT-REQUIRED header");
    }
  }
  try {
    return await response.clone().json();
  } catch {
    throw new Error("Malformed x402 payment requirement");
  }
}

export function createQusto(config: QustoConfig) {
  const timeoutMs = config.evaluationTimeoutMs ?? 500;
  if (timeoutMs <= 0 || timeoutMs > 5_000) {
    throw new Error("evaluationTimeoutMs must be between 1 ms and 5 seconds");
  }
  const failureMode =
    config.failureMode ??
    (config.environment === "development" ? "open" : "closed");
  const controlPlaneFetch = config.fetch ?? fetch;
  const evaluateUrl = apiUrl(config.baseUrl, "/api/public/v1/policy/evaluate");
  const eventsUrl = apiUrl(config.baseUrl, "/api/public/v1/events/batch");
  let eventBuffer: readonly PublicTraceEvent[] = [];
  let closed = false;

  const queue = (event: PublicTraceEvent): void => {
    if (closed) return;
    eventBuffer = [...eventBuffer, structuredClone(event)];
    if (eventBuffer.length >= 100) void flush();
  };

  const emit = (
    traceId: string,
    type: PublicTraceEvent["type"],
    payload: Readonly<Record<string, unknown>> = {}
  ): void => {
    queue({
      eventId: identifier("evt"),
      occurredAt: new Date().toISOString(),
      payload: structuredClone(payload),
      traceId,
      type
    });
  };

  const flush = async (): Promise<void> => {
    if (eventBuffer.length === 0) return;
    const batch = eventBuffer.slice(0, 100);
    eventBuffer = eventBuffer.slice(100);
    try {
      const response = await controlPlaneFetch(eventsUrl, {
        body: JSON.stringify({ events: batch }),
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(5_000)
      });
      if (!response.ok)
        throw new Error(`Event ingestion returned ${String(response.status)}`);
    } catch (error) {
      eventBuffer = [...batch, ...eventBuffer];
      throw error;
    }
    if (eventBuffer.length > 0) await flush();
  };

  const evaluate = async (input: EvaluationInput): Promise<QustoDecision> => {
    const traceId = input.traceId ?? identifier("trace");
    const idempotencyKey = input.idempotencyKey ?? identifier("pay");
    const { tool, ...withoutOptional } = input;
    try {
      const response = await controlPlaneFetch(evaluateUrl, {
        body: JSON.stringify({
          ...withoutOptional,
          idempotencyKey,
          traceId,
          ...(tool === undefined ? {} : { tool })
        }),
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok)
        throw new Error(`Policy API returned ${String(response.status)}`);
      const decision = parseDecision(await response.json(), traceId);
      emit(
        traceId,
        decision.outcome === "allow" ? "policy.allowed" : "policy.denied",
        { reasonCodes: decision.reasonCodes }
      );
      return decision;
    } catch {
      emit(traceId, "policy.unavailable", { errorCode: "POLICY_UNAVAILABLE" });
      return {
        decisionId: identifier("unavailable"),
        outcome: failureMode === "open" ? "allow" : "deny",
        reasonCodes: ["POLICY_UNAVAILABLE"],
        traceId
      };
    }
  };

  const createGovernedFetch =
    (options: GovernedFetchOptions) =>
    async (
      input: RequestInfo | URL,
      init: RequestInit = {}
    ): Promise<Response> => {
      const transport = options.transport ?? fetch;
      const request = new Request(input, init);
      const outboundHeaders = new Headers(request.headers);
      const tool =
        options.tool ?? outboundHeaders.get("x-qusto-tool") ?? undefined;
      outboundHeaders.delete("x-qusto-tool");
      const requestBody =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.clone().arrayBuffer();
      const first = await transport(request.url, {
        headers: outboundHeaders,
        method: request.method,
        signal: request.signal,
        ...(requestBody === undefined ? {} : { body: requestBody })
      });
      if (first.status !== 402) return first;

      const required = normalizePaymentRequired(
        await paymentRequiredFromResponse(first)
      );
      const requirement = required.requirements[0];
      if (requirement === undefined)
        throw new Error("No supported x402 requirement");
      const traceId = identifier("trace");
      emit(traceId, "payment.required", {
        amountAtomic: requirement.amountAtomic,
        asset: requirement.asset,
        network: requirement.network,
        payee: requirement.payTo,
        resourceUrl: required.resourceUrl
      });
      const decision = await evaluate({
        amountAtomic: requirement.amountAtomic,
        asset: requirement.asset,
        network: requirement.network,
        payee: requirement.payTo,
        payer: options.signer.address ?? zeroAddress,
        phase: "buyer",
        protocolVersion: required.protocolVersion,
        resourceUrl: required.resourceUrl,
        scheme: requirement.scheme,
        traceId,
        ...(tool === undefined ? {} : { tool })
      });
      if (decision.outcome === "deny") {
        throw new PolicyDeniedError(decision.decisionId, decision.reasonCodes);
      }
      const paymentPayload = await options.signer.createPaymentPayload({
        protocolVersion: required.protocolVersion,
        requirement,
        resourceUrl: required.resourceUrl,
        traceId
      });
      emit(traceId, "payment.created");
      const headers = new Headers(outboundHeaders);
      headers.set(
        required.protocolVersion === 2 ? "payment-signature" : "x-payment",
        paymentPayload
      );
      const response = await transport(request.url, {
        headers,
        method: request.method,
        signal: request.signal,
        ...(requestBody === undefined ? {} : { body: requestBody })
      });
      emit(
        traceId,
        response.ok ? "settlement.succeeded" : "settlement.failed",
        { status: response.status }
      );
      return response;
    };

  return {
    buyer: { evaluate },
    createGovernedFetch,
    emit,
    evaluate,
    flush,
    seller: {
      evaluate: (input: Omit<EvaluationInput, "phase">) =>
        evaluate({ ...input, phase: "seller" })
    },
    async shutdown(): Promise<void> {
      await flush();
      closed = true;
    }
  };
}
