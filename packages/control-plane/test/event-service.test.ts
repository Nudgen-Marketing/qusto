import { describe, expect, it } from "vitest";

import { ingestEvents } from "../src/index.js";
import type { EventRepository, TraceEvent } from "../src/index.js";

class MemoryEventRepository implements EventRepository {
  readonly ids = new Set<string>();

  async insertEvents(events: readonly TraceEvent[]) {
    const accepted: string[] = [];
    const duplicates: string[] = [];

    for (const event of events) {
      if (this.ids.has(event.eventId)) duplicates.push(event.eventId);
      else {
        this.ids.add(event.eventId);
        accepted.push(event.eventId);
      }
    }

    return { accepted, duplicates };
  }
}

describe("ingestEvents", () => {
  it("reports accepted and duplicate event IDs", async () => {
    const repository = new MemoryEventRepository();
    const event: TraceEvent = {
      environmentId: "env_prod",
      eventId: "01JZ9M7ENM8WD8CQXT6BC44GYQ",
      occurredAt: "2026-07-18T04:00:00.000Z",
      payload: {},
      traceId: "01JZ9M7ENM8WD8CQXT6BC44GYR",
      type: "payment.required"
    };

    await ingestEvents([event], repository);
    const result = await ingestEvents([event], repository);

    expect(result).toEqual({
      accepted: [],
      duplicates: [event.eventId],
      rejected: []
    });
  });
});
