const payloadAllowlist = new Set([
  "amountAtomic",
  "asset",
  "errorCode",
  "latencyMs",
  "network",
  "payee",
  "payer",
  "paymentIdentifier",
  "protocolVersion",
  "reasonCodes",
  "resourceUrl",
  "sdkVersion",
  "status",
  "tool",
  "transactionHash"
]);

const sensitiveQueryKeys = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "key",
  "password",
  "secret",
  "signature",
  "token"
]);

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  for (const key of [...url.searchParams.keys()]) {
    if (sensitiveQueryKeys.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.username = "";
  url.password = "";
  return url.toString();
}

function isSafeValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }
  return Array.isArray(value) && value.every((item) => isSafeValue(item));
}

export function sanitizeTracePayload(
  payload: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!payloadAllowlist.has(key)) continue;
    if (key === "resourceUrl") {
      const url = sanitizeUrl(value);
      if (url !== undefined) sanitized[key] = url;
    } else if (isSafeValue(value)) {
      sanitized[key] = structuredClone(value);
    }
  }
  if (new TextEncoder().encode(JSON.stringify(sanitized)).length > 32 * 1024) {
    throw new Error("Trace payload exceeds the 32 KiB limit");
  }
  return sanitized;
}
