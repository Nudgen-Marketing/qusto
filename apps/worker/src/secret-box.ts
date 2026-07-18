import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function decodeKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) {
    throw new Error("QUSTO_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(
  plaintext: string,
  encodedKey: string,
  nonceFactory: () => Buffer = () => randomBytes(12)
): string {
  const nonce = nonceFactory();
  if (nonce.length !== 12) throw new Error("AES-GCM nonce must be 12 bytes");
  const cipher = createCipheriv("aes-256-gcm", decodeKey(encodedKey), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
}

export function decryptSecret(ciphertext: string, encodedKey: string): string {
  const [version, nonceValue, tagValue, encryptedValue, ...extra] =
    ciphertext.split(":");
  if (
    version !== "v1" ||
    nonceValue === undefined ||
    tagValue === undefined ||
    encryptedValue === undefined ||
    extra.length > 0
  ) {
    throw new Error("Invalid encrypted secret envelope");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeKey(encodedKey),
    Buffer.from(nonceValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
