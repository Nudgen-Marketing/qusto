import { resolveBaseNetwork } from "@qusto/contracts";

interface JsonRpcResponse {
  readonly error?: unknown;
  readonly result?: unknown;
}

function jsonRpcResponse(value: unknown): JsonRpcResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Base Sepolia RPC service returned an invalid response");
  }
  return value;
}

function rpcUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Base Sepolia RPC configuration must use HTTP(S)");
  }
  return url;
}

export async function validateBaseSepoliaRpc(
  urlValue: string,
  request: typeof fetch = fetch
): Promise<void> {
  const network = resolveBaseNetwork("base-sepolia");
  const expected = `0x${network.chainId.toString(16)}`;
  const url = rpcUrl(urlValue);
  let response: Response;
  try {
    response = await request(url, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: []
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new Error("Base Sepolia RPC service request failed");
  }
  if (!response.ok) {
    throw new Error(
      `Base Sepolia RPC service returned HTTP ${String(response.status)}`
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Base Sepolia RPC service returned invalid JSON");
  }
  const parsed = jsonRpcResponse(body);
  if (parsed.error !== undefined) {
    throw new Error("Base Sepolia RPC service returned a JSON-RPC error");
  }
  if (parsed.result !== expected) {
    throw new Error(
      `Base Sepolia RPC configuration returned chain ID ${String(parsed.result)}; expected ${expected}`
    );
  }
}
