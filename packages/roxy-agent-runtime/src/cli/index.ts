#!/usr/bin/env node
/**
 * roxy CLI — interactive terminal agent.
 *
 * Usage:
 *   pnpm cli [dir]            Working directory (default: cwd)
 *   --config <path>           Config file override
 *   --session <id>            Resume / label a session
 *   --log-level <level>       Override observability.logLevel
 *   --init                    Write a starter roxy.yaml to workdir, then exit
 *   --help / -h               Print help and exit
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import React from "react";
import { render } from "ink";
import type { LogLevel } from "../core/interfaces.ts";
import { createFileSink } from "../logging/sinks.ts";
import { createLogger } from "../logging/logger.ts";
import { App } from "./App.tsx";
import { loadCliConfig, type CliConfig } from "./config.ts";

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

const HELP = `
roxy — AI agent CLI

USAGE
  pnpm cli [dir] [options]

ARGUMENTS
  dir                Working directory (default: current directory)

OPTIONS
  --config <path>    Config file (.json or .yaml). Default: <dir>/roxy.json then roxy.yaml
  --session <id>     Session identifier (resumes log continuity)
  --log-level        Override observability.logLevel (trace|debug|info|warn|error)
  --thinking-budget <n>  Enable extended thinking with a token budget (overrides config)
  --init             Write a starter roxy.yaml to the working directory, then exit
  -h, --help         Show this help

EXAMPLES
  pnpm cli                     # Start in current directory
  pnpm cli ~/projects/myapp    # Start with a specific working directory
  pnpm cli --init              # Create a starter roxy.yaml
  pnpm cli --config ./custom.yaml
`.trim();

// ---------------------------------------------------------------------------
// --init template (DeepSeek default)
// ---------------------------------------------------------------------------

const INIT_TEMPLATE = `# roxy agent configuration
# See https://github.com/yourorg/roxy-agent for full reference.

provider:
  id: deepseek
  model: deepseek-v4-flash
  apiKeyEnv: DEEPSEEK_API_KEY
  baseURL: https://api.deepseek.com
  maxTokens: 8192

system:
  systemPrompt: "You are a helpful coding assistant."

memory:
  trim:
    mode: turns
    keep: 20
  summarize: false

sessions:
  enabled: true   # persist conversation rollout to .roxy/sessions; --session <id> resumes
  dir: .roxy/sessions

hitl:
  mode: full      # full | strict | delegate

clarification:
  enabled: false

todos:
  enabled: false

skills:
  dir: ./skills

mcp:
  servers: []
  # Example stdio MCP server:
  # - name: filesystem
  #   transport: stdio
  #   command: npx
  #   args: ["-y", "@modelcontextprotocol/server-filesystem", "."]

observability:
  logLevel: info
  # trajectoryFile: .roxy/trajectory.jsonl
`;

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolvePaths(config: CliConfig, workdir: string): CliConfig {
  return {
    ...config,
    sessions: {
      ...config.sessions,
      dir: resolve(workdir, config.sessions.dir),
    },
    skills: {
      ...config.skills,
      dir: resolve(workdir, config.skills.dir),
    },
    observability: {
      ...config.observability,
      trajectoryFile: config.observability.trajectoryFile
        ? resolve(workdir, config.observability.trajectoryFile)
        : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Config discovery
// ---------------------------------------------------------------------------

function findConfig(workdir: string, explicitPath?: string): string | null {
  if (explicitPath) {
    const abs = resolve(explicitPath);
    return existsSync(abs) ? abs : null;
  }
  for (const name of ["roxy.json", "roxy.yaml", "roxy.yml"]) {
    const p = join(workdir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      config: { type: "string" },
      session: { type: "string" },
      "log-level": { type: "string" },
      "thinking-budget": { type: "string" },
      init: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Working directory
  const workdir = resolve(positionals[0] ?? process.cwd());
  const displayDir = workdir.startsWith(homedir()) ? "~" + workdir.slice(homedir().length) : workdir;

  // --init
  if (values.init) {
    const outPath = join(workdir, "roxy.yaml");
    if (existsSync(outPath)) {
      console.error(`roxy.yaml already exists at ${outPath}`);
      process.exit(1);
    }
    writeFileSync(outPath, INIT_TEMPLATE, "utf-8");
    console.log(`Created ${outPath}`);
    console.log("Edit the file, then run: pnpm cli");
    process.exit(0);
  }

  // Config
  const configPath = findConfig(workdir, values.config as string | undefined);
  if (!configPath) {
    const tried = values.config ?? `${workdir}/roxy.json or roxy.yaml`;
    console.error(`No config found (looked for ${tried})`);
    console.error("Run with --init to create a starter config.");
    process.exit(1);
  }

  let config: CliConfig;
  try {
    config = await loadCliConfig({ path: configPath });
  } catch (err: unknown) {
    console.error(`Failed to load config: ${configPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Resolve relative paths in config against workdir
  config = resolvePaths(config, workdir);

  // --log-level override
  const logLevels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];
  const rawLevel = values["log-level"];
  if (rawLevel && logLevels.includes(rawLevel as LogLevel)) {
    config = {
      ...config,
      observability: { ...config.observability, logLevel: rawLevel as LogLevel },
    };
  }

  // --thinking-budget override: enable extended thinking (or override config).
  // Extended thinking is Anthropic-only, so this override applies exclusively
  // to the anthropic provider; it is ignored (with a warning) otherwise.
  const rawBudget = values["thinking-budget"];
  if (rawBudget !== undefined) {
    const budgetTokens = Number(rawBudget);
    if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
      console.error(`--thinking-budget must be a positive integer (got: ${rawBudget})`);
      process.exit(1);
    }
    if (config.provider.id === "anthropic") {
      config = {
        ...config,
        provider: { ...config.provider, thinking: { budgetTokens } },
      };
    } else {
      console.error(
        `--thinking-budget ignored: extended thinking is only supported by the anthropic provider (got: ${config.provider.id})`,
      );
    }
  }

  // Prepend working directory to system prompt so agent knows its cwd
  const wdNote = `Working directory: ${workdir}\n`;
  config = {
    ...config,
    system: {
      ...config.system,
      systemPrompt: wdNote + (config.system.systemPrompt ?? ""),
    },
  };

  // Logger — write to <workdir>/.roxy.log (never stdout, which Ink owns)
  const logPath = join(workdir, ".roxy.log");
  const logger = createLogger({
    level: config.observability.logLevel,
    scope: "roxy-cli",
    sinks: [createFileSink(logPath)],
  });

  if (!process.stdin.isTTY) {
    console.error("roxy requires an interactive terminal (stdin must be a TTY).");
    process.exit(1);
  }

  const sessionId = (values.session as string | undefined) ?? randomUUID();

  logger.info("roxy CLI starting", {
    configPath,
    workdir,
    sessionId,
    model: config.provider.model,
  });

  render(
    React.createElement(App, {
      config,
      workdir: displayDir,
      sessionId,
      logger,
    }),
    { exitOnCtrlC: false },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
