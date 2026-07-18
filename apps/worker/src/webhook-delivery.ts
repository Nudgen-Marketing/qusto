import { signWebhook } from "./webhook-signature.js";

export interface WebhookDeliveryInput {
  readonly deliveryId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly secret: string;
  readonly url: string;
}

interface WebhookDeliveryOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export async function deliverWebhook(
  input: WebhookDeliveryInput,
  options: WebhookDeliveryOptions = {}
): Promise<number> {
  const url = new URL(input.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Webhook URL must use HTTP(S)");
  }
  const now = (options.now ?? (() => new Date()))();
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const body = JSON.stringify(input.payload);
  const signed = signWebhook(input.deliveryId, timestamp, body, input.secret);
  const response = await (options.fetch ?? fetch)(url.toString(), {
    body: signed.body,
    headers: signed.headers,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs ?? 5_000)
  });
  if (!response.ok) {
    throw new Error(`Webhook receiver returned ${String(response.status)}`);
  }
  return response.status;
}
