import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@qusto/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url)
      ),
      "@qusto/control-plane": fileURLToPath(
        new URL("./packages/control-plane/src/index.ts", import.meta.url)
      ),
      "@qusto/policy-engine": fileURLToPath(
        new URL("./packages/policy-engine/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    coverage: {
      exclude: ["**/*.d.ts", "**/*.config.*", "**/dist/**", "apps/web/**"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false
  }
});
