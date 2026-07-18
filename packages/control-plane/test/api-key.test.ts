import { describe, expect, it } from "vitest";

import { createApiKey, parseAndHashApiKey } from "../src/index.js";

describe("project API keys", () => {
  it("creates a display-once key and stores only a hash", () => {
    const generated = createApiKey(() => Buffer.alloc(32, 7));

    expect(generated.token).toMatch(/^qsk_[A-Za-z0-9_-]{12}_[A-Za-z0-9_-]+$/);
    expect(generated.secretHash).toHaveLength(64);
    expect(generated.secretHash).not.toContain(generated.token);
    expect(parseAndHashApiKey(generated.token)).toEqual({
      lookup: generated.lookup,
      secretHash: generated.secretHash
    });
  });

  it("rejects malformed keys", () => {
    expect(() => parseAndHashApiKey("qsk_invalid")).toThrow("Invalid Qusto API key");
  });
});
