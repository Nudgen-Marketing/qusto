import type { RpcCall } from "./reconciliation.js";

interface JsonRpcResponse {
  readonly error?: { readonly code: number; readonly message: string };
  readonly result?: unknown;
}

export function createJsonRpcCall(
  urlValue: string,
  fetchImplementation: typeof fetch = fetch
): RpcCall {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("BASE_RPC_URL must use HTTP(S)");
  }
  let id = 0;
  return async (method, params) => {
    id += 1;
    const response = await fetchImplementation(url, {
      body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      throw new Error(`Base RPC returned ${String(response.status)}`);
    }
    const body = (await response.json()) as JsonRpcResponse;
    if (body.error !== undefined) {
      throw new Error(
        `Base RPC error ${String(body.error.code)}: ${body.error.message}`
      );
    }
    return body.result;
  };
}
