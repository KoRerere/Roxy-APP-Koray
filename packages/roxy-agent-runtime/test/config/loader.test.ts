import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCliConfig } from "../../src/cli/config.ts";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "roxy-test-config-"));
}

/** Minimal valid CLI config as a plain object. */
const VALID: unknown = {
  provider: { id: "anthropic", model: "claude-sonnet-4-5", apiKeyEnv: "ANTHROPIC_API_KEY", maxTokens: 8192 },
  system: {},
  memory: { trim: { mode: "turns", keep: 20 }, summarize: false },
  sessions: { enabled: false, dir: "/tmp/roxy/sessions" },
  hitl: { mode: "full" },
  clarification: { enabled: true },
  todos: { enabled: true },
  skills: { dir: "/tmp/roxy/skills" },
  mcp: { servers: [] },
  observability: { logLevel: "info" },
};

describe("loadCliConfig", () => {
  it("parses a valid JSON config file", async () => {
    const dir = tmpDir();
    const path = join(dir, "roxy.json");
    writeFileSync(path, JSON.stringify(VALID));
    const config = await loadCliConfig({ path });
    expect(config.provider.model).toBe("claude-sonnet-4-5");
    expect(config.hitl.mode).toBe("full");
  });

  it("parses a valid YAML config file", async () => {
    const dir = tmpDir();
    const path = join(dir, "roxy.yaml");
    writeFileSync(
      path,
      [
        "provider:",
        "  id: anthropic",
        "  model: claude-haiku-4-5-20251001",
        "  apiKeyEnv: ANTHROPIC_API_KEY",
        "  maxTokens: 4096",
        "system: {}",
        "memory:",
        "  trim:",
        "    mode: turns",
        "    keep: 10",
        "  summarize: false",
        "sessions:",
        "  enabled: false",
        "  dir: /tmp/s",
        "hitl:",
        "  mode: strict",
        "clarification:",
        "  enabled: false",
        "todos:",
        "  enabled: false",
        "skills:",
        "  dir: /tmp/skills",
        "mcp:",
        "  servers: []",
        "observability:",
        "  logLevel: debug",
      ].join("\n"),
    );
    const config = await loadCliConfig({ path });
    expect(config.provider.model).toBe("claude-haiku-4-5-20251001");
    expect(config.observability.logLevel).toBe("debug");
  });

  it("parses DeepSeek defaultHeaders", async () => {
    // Regression: the DeepSeek CLI schema dropped defaultHeaders before the
    // provider could forward proxy routing or custom authentication headers.
    // Fixed by: the DeepSeek config branch owns the same explicit header map.
    const dir = tmpDir();
    const path = join(dir, "deepseek.json");
    const configInput = {
      ...(VALID as Record<string, unknown>),
      provider: {
        id: "deepseek",
        model: "deepseek-chat",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        maxTokens: 8192,
        baseURL: "https://proxy.example.test/anthropic",
        defaultHeaders: { Authorization: "Bearer proxy-token", "Conversation-Id": "conversation-1" },
      },
    };
    writeFileSync(path, JSON.stringify(configInput));

    const config = await loadCliConfig({ path });
    expect(config.provider).toMatchObject({
      id: "deepseek",
      defaultHeaders: { Authorization: "Bearer proxy-token", "Conversation-Id": "conversation-1" },
    });
  });

  it("throws when the config is structurally invalid", async () => {
    const dir = tmpDir();
    const path = join(dir, "bad.json");
    writeFileSync(path, JSON.stringify({ not: "a valid config" }));
    await expect(loadCliConfig({ path })).rejects.toThrow();
  });

  it("keeps environment-variable names as CLI input", async () => {
    const dir = tmpDir();
    const path = join(dir, "roxy.json");
    writeFileSync(path, JSON.stringify(VALID));
    const config = await loadCliConfig({ path });
    expect(config.provider.id).toBe("anthropic");
    if (config.provider.id === "anthropic") {
      expect(config.provider.apiKeyEnv).toBe("ANTHROPIC_API_KEY");
    }
  });
});
