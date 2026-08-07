import { describe, expect, it } from "vitest";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative } from "node:path";

const SRC = new URL("../../src/", import.meta.url);
const RUNTIME_DIR = new URL("runtime/", SRC).pathname;

async function listTsFiles(dir: URL): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name, dir).pathname;
    if (entry.isDirectory()) {
      out.push(...(await listTsFiles(new URL(`${entry.name}/`, dir))));
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

describe("architecture boundaries", () => {
  it("does not import @langchain/langgraph anywhere in src", async () => {
    const files = await listTsFiles(SRC);
    const violations: string[] = [];
    for (const file of files) {
      const src = await readFile(file, "utf8");
      if (/@langchain\/langgraph/.test(src)) {
        violations.push(relative(".", file));
      }
    }
    expect(violations).toEqual([]);
  });

  it("no banned libraries are imported anywhere in src", async () => {
    const banned = ["pino", "winston", "reflect-metadata"];
    const files = await listTsFiles(SRC);
    const violations: string[] = [];
    for (const file of files) {
      const src = await readFile(file, "utf8");
      for (const lib of banned) {
        // match `from "lib"` or `from "lib/..."`
        const re = new RegExp(`from\\s+["']${lib}(\\/|["'])`);
        if (re.test(src)) {
          violations.push(`${relative(".", file)} imports ${lib}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps host configuration outside the framework public surface", async () => {
    const publicEntry = await readFile(new URL("index.ts", SRC), "utf8");
    const contracts = await readFile(new URL("core/interfaces.ts", SRC), "utf8");
    const anthropic = await readFile(new URL("provider/anthropic.ts", SRC), "utf8");
    const deepseek = await readFile(new URL("provider/deepseek.ts", SRC), "utf8");

    expect(publicEntry).not.toMatch(/loadConfig|createProvider|createAgentFromConfig|RoxyConfig/);
    expect(contracts).not.toMatch(/RoxyConfig|RoxyProviderConfig|apiKeyEnv/);
    expect(anthropic).not.toContain("process.env");
    expect(deepseek).not.toContain("process.env");
  });

  it("splits public contracts by feature behind the compatibility barrel", async () => {
    // Regression: all framework contracts lived in one 1900-line interfaces.ts,
    // coupling unrelated feature edits and making ownership boundaries unclear.
    // Fixed by: feature-scoped contract modules re-exported by interfaces.ts.
    const modules = [
      "logging",
      "observability",
      "provider",
      "tools",
      "skills",
      "mcp",
      "memory",
      "context",
      "hitl",
      "clarification",
      "todo",
      "subagent",
      "agent",
      "lifecycle",
      "plugins",
    ];
    const barrel = await readFile(new URL("core/interfaces.ts", SRC), "utf8");

    expect(barrel).not.toMatch(/^export (?:interface|type) /m);
    for (const mod of modules) {
      expect(await isFile(new URL(`core/contracts/${mod}.ts`, SRC).pathname), `missing contract module: ${mod}`).toBe(
        true,
      );
      expect(barrel).toContain(`export * from "./contracts/${mod}.ts"`);
    }
  });

  it("every module has a README.md", async () => {
    const modules = [
      "core",
      "logging",
      "observability",
      "provider",
      "tools",
      "skills",
      "mcp",
      "memory",
      "hitl",
      "subagent",
      "runtime",
    ];
    for (const mod of modules) {
      const readme = new URL(`${mod}/README.md`, SRC).pathname;
      expect(await isFile(readme), `missing ${mod}/README.md`).toBe(true);
    }
  });
});
