import {
  eventBatchSchema,
  policyEvaluationRequestSchema
} from "@qusto/contracts";
import type {
  PolicyEvaluationRequest,
  PublicTraceEvent
} from "@qusto/contracts";
import type { TraceEvent } from "@qusto/control-plane";

export interface ApiKeyContext {
  readonly environmentId: string;
}

export interface PublicApiDependencies {
  authenticate(token: string): Promise<ApiKeyContext | undefined>;
  evaluate(
    context: ApiKeyContext,
    request: PolicyEvaluationRequest
  ): Promise<unknown>;
  ingest(
    environmentId: string,
    events: readonly TraceEvent[]
  ): Promise<unknown>;
}

export interface PublicApi {
  evaluate(request: Request): Promise<Response>;
  events(request: Request): Promise<Response>;
}

interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

function errorResponse(
  status: number,
  code: string,
  message: string
): Response {
  const error: ApiError = {
    code,
    message,
    requestId: crypto.randomUUID()
  };

  return Response.json({ error, ok: false }, { status });
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length === 0 ? undefined : token;
}

async function authenticate(
  request: Request,
  dependency: PublicApiDependencies["authenticate"]
): Promise<ApiKeyContext | Response> {
  const token = bearerToken(request);
  if (token === undefined) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      "A valid project API key is required"
    );
  }

  const context = await dependency(token);
  return (
    context ??
    errorResponse(401, "UNAUTHORIZED", "A valid project API key is required")
  );
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function isResponse(value: ApiKeyContext | Response): value is Response {
  return value instanceof Response;
}

function withEnvironment(
  environmentId: string,
  event: PublicTraceEvent
): TraceEvent {
  return { ...event, environmentId };
}

export function createPublicApi(
  dependencies: PublicApiDependencies
): PublicApi {
  return {
    async evaluate(request) {
      try {
        const context = await authenticate(request, (token) =>
          dependencies.authenticate(token)
        );
        if (isResponse(context)) return context;

        const parsed = policyEvaluationRequestSchema.safeParse(
          await requestJson(request)
        );
        if (!parsed.success) {
          return errorResponse(
            400,
            "VALIDATION_ERROR",
            "The policy request is invalid"
          );
        }

        const decision = await dependencies.evaluate(context, parsed.data);
        return Response.json({ data: decision, ok: true });
      } catch {
        return errorResponse(
          500,
          "INTERNAL_ERROR",
          "The request could not be completed"
        );
      }
    },

    async events(request) {
      try {
        const context = await authenticate(request, (token) =>
          dependencies.authenticate(token)
        );
        if (isResponse(context)) return context;

        const parsed = eventBatchSchema.safeParse(await requestJson(request));
        if (!parsed.success) {
          return errorResponse(
            400,
            "VALIDATION_ERROR",
            "The event batch is invalid"
          );
        }

        const result = await dependencies.ingest(
          context.environmentId,
          parsed.data.events.map((event) =>
            withEnvironment(context.environmentId, event)
          )
        );
        return Response.json({ data: result, ok: true }, { status: 202 });
      } catch {
        return errorResponse(
          500,
          "INTERNAL_ERROR",
          "The request could not be completed"
        );
      }
    }
  };
}
