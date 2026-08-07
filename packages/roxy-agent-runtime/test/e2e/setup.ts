/**
 * Vitest globalSetup for e2e tests.
 * Loads .env.e2e into process.env before any test worker is spawned.
 * If the file is absent the setup is silently skipped — tests auto-skip via
 * the `describe.skipIf(!DEEPSEEK_API_KEY)` guard in each test file.
 */
import { readFileSync } from "node:fs";

export function setup(): void {
  let raw: string;
  try {
    raw = readFileSync(".env.e2e", "utf8");
  } catch {
    return; // file not present — tests will skip
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const raw_val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    const value = raw_val.replace(/^(["'])(.*)\1$/, "$2");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
