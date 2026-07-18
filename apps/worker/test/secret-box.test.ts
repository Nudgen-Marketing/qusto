import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../src/secret-box.js";

describe("secret encryption", () => {
  it("round-trips webhook secrets with authenticated AES-256-GCM", () => {
    const key = randomBytes(32).toString("base64url");
    const encrypted = encryptSecret("webhook-value", key, () =>
      Buffer.alloc(12, 7)
    );

    expect(encrypted).not.toContain("webhook-value");
    expect(decryptSecret(encrypted, key)).toBe("webhook-value");
    expect(() => decryptSecret(`${encrypted}x`, key)).toThrow();
  });
});
