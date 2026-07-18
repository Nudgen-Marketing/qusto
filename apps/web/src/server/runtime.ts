import {
  completeReservation,
  evaluatePayment,
  ingestEvents,
  releaseReservation
} from "@qusto/control-plane";
import {
  PostgresApiKeyRepository,
  PostgresEvaluationRepository,
  PostgresEventRepository,
  PostgresReservationRepository,
  PostgresRuntimeRepository
} from "@qusto/database/public-runtime";

import { createPublicApi } from "./public-api";

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (value === undefined || value.length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  return value;
}

let cachedApi: ReturnType<typeof createPublicApi> | undefined;

export function getPublicApi(): ReturnType<typeof createPublicApi> {
  if (cachedApi !== undefined) return cachedApi;
  const url = databaseUrl();
  const apiKeys = new PostgresApiKeyRepository(url);
  const evaluations = new PostgresEvaluationRepository(url);
  const events = new PostgresEventRepository(url);
  const reservations = new PostgresReservationRepository(url);
  const runtime = new PostgresRuntimeRepository(url);

  cachedApi = createPublicApi({
    authenticate: (token) => apiKeys.authenticate(token),
    completeReservation: (environmentId, reservationId, completion) =>
      completeReservation(
        environmentId,
        reservationId,
        completion,
        reservations
      ),
    async evaluate(context, request) {
      const policy = await runtime.getActivePolicy(context.environmentId);
      if (policy === undefined) throw new Error("Active policy not found");
      const { tool, ...requestWithoutTool } = request;
      return evaluatePayment(
        {
          ...requestWithoutTool,
          environmentId: context.environmentId,
          policyVersionId: policy.id,
          ...(tool === undefined ? {} : { tool })
        },
        policy.rules,
        evaluations
      );
    },
    ingest: (environmentId, batch) => ingestEvents(batch, events),
    releaseReservation: (environmentId, reservationId) =>
      releaseReservation(environmentId, reservationId, reservations)
  });
  return cachedApi;
}

export async function databaseReady(): Promise<boolean> {
  const repository = new PostgresRuntimeRepository(databaseUrl());
  try {
    return await repository.isReady();
  } finally {
    await repository.close();
  }
}
