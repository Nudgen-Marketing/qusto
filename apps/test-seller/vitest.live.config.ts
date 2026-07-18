import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 210_000,
    include: ["apps/test-seller/e2e/**/*.live.ts"],
    maxWorkers: 1,
    testTimeout: 210_000
  }
});
