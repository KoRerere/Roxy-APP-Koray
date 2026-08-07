import { defineConfig } from "vitest/config";

/**
 * Vitest config for end-to-end tests against a real API provider.
 *
 * Run via:  pnpm test:e2e
 * Env vars: loaded from .env.e2e if present (Node --env-file-if-exists)
 * Skip:     tests auto-skip when DEEPSEEK_API_KEY is not set
 */
export default defineConfig({
  test: {
    include: ["test/e2e/**/*.e2e.ts"],
    globalSetup: ["test/e2e/setup.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
});
