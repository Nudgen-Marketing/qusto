import { traceEventSchema } from "@qusto/contracts";

export interface TraceEvent {
  readonly environmentId: string;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly traceId: string;
  readonly type:
    | "chain.confirmed"
    | "chain.finalized"
    | "chain.reverted"
    | "payment.created"
    | "payment.required"
    | "policy.allowed"
    | "policy.denied"
    | "policy.unavailable"
    | "settlement.failed"
    | "settlement.submitted"
    | "settlement.succeeded"
    | "verification.failed"
    | "verification.succeeded";
}

export interface EventInsertResult {
  readonly accepted: readonly string[];
  readonly duplicates: readonly string[];
}

export interface EventRepository {
  insertEvents(events: readonly TraceEvent[]): Promise<EventInsertResult>;
}

export interface EventIngestionResult extends EventInsertResult {
  readonly rejected: readonly string[];
}

export async function ingestEvents(
  events: readonly TraceEvent[],
  repository: EventRepository
): Promise<EventIngestionResult> {
  const valid: TraceEvent[] = [];
  const rejected: string[] = [];

  for (const event of events) {
    const result = traceEventSchema.safeParse(event);
    if (result.success) valid.push(event);
    else rejected.push(event.eventId);
  }

  const inserted =
    valid.length === 0
      ? { accepted: [], duplicates: [] }
      : await repository.insertEvents(valid);

  return { ...inserted, rejected };
}
