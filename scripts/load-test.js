import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    telemetry: {
      executor: "constant-arrival-rate",
      duration: __ENV.DURATION || "30m",
      preAllocatedVUs: 20,
      rate: Number(__ENV.RATE || 100),
      timeUnit: "1s"
    }
  },
  thresholds: {
    checks: ["rate>0.999"],
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.001"]
  }
};

export default function () {
  const eventId = `${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(
    `${__ENV.QUSTO_BASE_URL}/api/public/v1/events/batch`,
    JSON.stringify({
      events: [
        {
          eventId,
          eventType: "payment.required",
          metadata: { loadTest: true },
          occurredAt: new Date().toISOString(),
          schemaVersion: 1,
          traceId: `load-${eventId}`
        }
      ]
    }),
    {
      headers: {
        Authorization: `Bearer ${__ENV.QUSTO_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
  check(response, { accepted: (result) => result.status === 200 });
}
