import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

interface LookupAddress {
  readonly address: string;
  readonly family: number;
}

export interface SafeFetchOptions {
  readonly allowPrivateAddresses?: boolean;
  readonly lookup?: (hostname: string) => Promise<readonly LookupAddress[]>;
  readonly maxRedirects?: number;
  readonly maxResponseBytes?: number;
  readonly timeoutMs?: number;
}

export interface SafeTarget {
  readonly address: string;
  readonly family: number;
  readonly hostname: string;
  readonly url: URL;
}

function ipv4Number(address: string): number {
  return (
    address
      .split(".")
      .map(Number)
      .reduce((total, part) => (total << 8) + part, 0) >>> 0
  );
}

function inIpv4Cidr(address: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

function isPrivateIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["224.0.0.0", 4]
    ].some(([base, bits]) => inIpv4Cidr(address, String(base), Number(bits)));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("::ffff:")
    );
  }
  return true;
}

export async function resolveSafeTarget(
  urlValue: string | URL,
  options: SafeFetchOptions = {}
): Promise<SafeTarget> {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP(S) URLs are allowed");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  const lookup =
    options.lookup ??
    ((hostname: string) => dnsLookup(hostname, { all: true, verbatim: true }));
  const addresses = await lookup(url.hostname);
  if (addresses.length === 0) throw new Error("Hostname did not resolve");
  if (
    options.allowPrivateAddresses !== true &&
    addresses.some(({ address }) => isPrivateIp(address))
  ) {
    throw new Error("Private, loopback, and link-local addresses are blocked");
  }
  const selected = addresses[0];
  if (selected === undefined) throw new Error("Hostname did not resolve");
  return {
    address: selected.address,
    family: selected.family,
    hostname: url.hostname,
    url
  };
}

async function bodyBuffer(
  body: BodyInit | null | undefined
): Promise<Buffer | undefined> {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  throw new Error(
    "Streaming request bodies are not supported by MCP safe fetch"
  );
}

async function pinnedRequest(
  target: SafeTarget,
  init: RequestInit,
  options: SafeFetchOptions
): Promise<Response> {
  const requestBody = await bodyBuffer(init.body);
  const headers = new Headers(init.headers);
  headers.set("host", target.url.host);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxResponseBytes ?? 1024 * 1024;

  return new Promise<Response>((resolve, reject) => {
    const requester =
      target.url.protocol === "https:" ? https.request : http.request;
    const request = requester(
      {
        family: target.family,
        headers: Object.fromEntries(headers.entries()),
        hostname: target.address,
        method: init.method ?? "GET",
        path: `${target.url.pathname}${target.url.search}`,
        port: target.url.port || undefined,
        ...(target.url.protocol === "https:"
          ? { servername: target.hostname }
          : {})
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(
              new Error("Response exceeded the configured size limit")
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) responseHeaders.append(key, item);
            } else if (value !== undefined) responseHeaders.set(key, value);
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              headers: responseHeaders,
              status: response.statusCode ?? 500,
              ...(response.statusMessage === undefined
                ? {}
                : { statusText: response.statusMessage })
            })
          );
        });
      }
    );
    request.setTimeout(timeoutMs, () =>
      request.destroy(new Error("Request timed out"))
    );
    request.on("error", reject);
    const signal = init.signal;
    if (signal !== undefined && signal !== null) {
      if (signal.aborted) request.destroy(new Error("Request aborted"));
      else
        signal.addEventListener(
          "abort",
          () => request.destroy(new Error("Request aborted")),
          { once: true }
        );
    }
    if (requestBody !== undefined) request.write(requestBody);
    request.end();
  });
}

export function createSafeFetch(options: SafeFetchOptions = {}): typeof fetch {
  const maxRedirects = Math.max(0, Math.min(5, options.maxRedirects ?? 3));
  const execute = async (
    input: RequestInfo | URL,
    init: RequestInit = {},
    redirectCount = 0
  ): Promise<Response> => {
    const request = new Request(input, init);
    const target = await resolveSafeTarget(request.url, options);
    const response = await pinnedRequest(
      target,
      {
        headers: request.headers,
        method: request.method,
        signal: request.signal,
        ...(request.method === "GET" || request.method === "HEAD"
          ? {}
          : { body: await request.clone().arrayBuffer() })
      },
      options
    );
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (location === null) return response;
    if (redirectCount >= maxRedirects) throw new Error("Too many redirects");
    const next = new URL(location, target.url);
    const switchToGet =
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        request.method === "POST");
    return execute(
      next,
      switchToGet
        ? { headers: request.headers, method: "GET", signal: request.signal }
        : {
            headers: request.headers,
            method: request.method,
            signal: request.signal,
            ...(request.method === "GET" || request.method === "HEAD"
              ? {}
              : { body: await request.clone().arrayBuffer() })
          },
      redirectCount + 1
    );
  };
  return execute;
}
