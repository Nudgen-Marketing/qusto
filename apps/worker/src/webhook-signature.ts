import { createHmac, timingSafeEqual } from "node:crypto";

export interface SignedWebhook {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

function digest(timestamp: string, body: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

export function signWebhook(
  deliveryId: string,
  timestamp: string,
  body: string,
  secret: string
): SignedWebhook {
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-qusto-delivery-id": deliveryId,
      "x-qusto-signature": `v1=${digest(timestamp, body, secret)}`,
      "x-qusto-timestamp": timestamp
    }
  };
}

export function verifyWebhookSignature(
  body: string,
  headers: Readonly<Record<string, string>>,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 300
): boolean {
  const timestamp = headers["x-qusto-timestamp"];
  const signature = headers["x-qusto-signature"];
  if (timestamp === undefined || signature === undefined) return false;
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > toleranceSeconds
  ) {
    return false;
  }
  const expected = Buffer.from(`v1=${digest(timestamp, body, secret)}`);
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
