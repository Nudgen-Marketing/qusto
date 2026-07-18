import { describe, expect, it } from "vitest";

import { sanitizeTracePayload } from "../src/telemetry.js";

describe("trace telemetry sanitization", () => {
  it("keeps allowlisted metadata and strips credentials and sensitive query values", () => {
    const sanitized = sanitizeTracePayload({
      amountAtomic: "1000",
      authorization: "Bearer credential",
      privateKey: "never-store",
      resourceUrl:
        "https://api.example.com/data?cursor=ok&api_key=remove&token=remove",
      transactionHash: "0xabc",
      unknownPayload: { body: "drop" }
    });

    expect(sanitized).toEqual({
      amountAtomic: "1000",
      resourceUrl: "https://api.example.com/data?cursor=ok",
      transactionHash: "0xabc"
    });
    expect(JSON.stringify(sanitized)).not.toContain("credential");
    expect(JSON.stringify(sanitized)).not.toContain("never-store");
  });

  it("rejects payloads over 32 KiB after allowlisting", () => {
    expect(() =>
      sanitizeTracePayload({ paymentIdentifier: "x".repeat(33 * 1024) })
    ).toThrow("32 KiB");
  });
});
