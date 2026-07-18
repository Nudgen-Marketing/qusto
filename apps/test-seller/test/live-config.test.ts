import { describe, expect, it } from "vitest";

import liveConfig from "../vitest.live.config.js";

describe("Base Sepolia live test configuration", () => {
  it("gives setup and cleanup hooks the full live-test budget", () => {
    expect(liveConfig).toMatchObject({
      test: {
        hookTimeout: 210_000,
        testTimeout: 210_000
      }
    });
  });
});
