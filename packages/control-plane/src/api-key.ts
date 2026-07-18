import { createHash, randomBytes } from "node:crypto";

const tokenPattern = /^qsk_([A-Za-z0-9_-]{12})_([A-Za-z0-9_-]{40,})$/;

export interface GeneratedApiKey {
  readonly lookup: string;
  readonly secretHash: string;
  readonly token: string;
}

export interface ApiKeyDigest {
  readonly lookup: string;
  readonly secretHash: string;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function createApiKey(
  entropy: (size: number) => Buffer = randomBytes
): GeneratedApiKey {
  const bytes = entropy(32);
  const lookup = bytes.subarray(0, 9).toString("base64url");
  const secret = bytes.toString("base64url");

  return {
    lookup,
    secretHash: hashSecret(secret),
    token: `qsk_${lookup}_${secret}`
  };
}

export function parseAndHashApiKey(token: string): ApiKeyDigest {
  const match = tokenPattern.exec(token);

  if (match === null) {
    throw new Error("Invalid Qusto API key");
  }
  const lookup = match[1];
  const secret = match[2];
  if (lookup === undefined || secret === undefined) {
    throw new Error("Invalid Qusto API key");
  }

  return {
    lookup,
    secretHash: hashSecret(secret)
  };
}
