import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { z } from "zod";

const trimPolicySchema = z.object({
  mode: z.enum(["turns", "tokens"]),
  keep: z.number().int().positive(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  transport: z.enum(["stdio", "http"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  token: z.string().optional(),
});

const providerSchema = z.discriminatedUnion("id", [
  z.object({
    id: z.literal("anthropic"),
    model: z.string(),
    apiKeyEnv: z.string(),
    maxTokens: z.number().int().positive(),
    contextWindowTokens: z.number().int().positive().optional(),
    baseURL: z.string().optional(),
    defaultHeaders: z.record(z.string(), z.string()).optional(),
    thinking: z.object({ budgetTokens: z.number().int().positive() }).optional(),
    promptCaching: z.boolean().optional(),
  }),
  z.object({
    id: z.literal("deepseek"),
    model: z.string(),
    apiKeyEnv: z.string(),
    maxTokens: z.number().int().positive(),
    contextWindowTokens: z.number().int().positive().optional(),
    baseURL: z.string(),
    defaultHeaders: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    id: z.literal("fake"),
    model: z.string(),
    maxTokens: z.number().int().positive(),
    contextWindowTokens: z.number().int().positive().optional(),
  }),
]);

const subagentSchema = z.object({
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  provider: providerSchema.optional(),
  tools: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional(),
});

/** JSON/YAML input schema owned exclusively by the bundled CLI application. */
export const CliConfigSchema = z.object({
  provider: providerSchema,
  system: z.object({ systemPrompt: z.string().optional() }),
  memory: z.object({
    trim: trimPolicySchema,
    summarize: z.boolean(),
    triggerTokens: z.number().int().positive().optional(),
    contextWindowTokens: z.number().int().positive().optional(),
  }),
  sessions: z.object({ enabled: z.boolean(), dir: z.string() }),
  hitl: z.object({
    mode: z.enum(["strict", "delegate", "full"]),
    rules: z.array(z.object({ match: z.string(), sensitive: z.boolean() })).optional(),
  }),
  clarification: z.object({ enabled: z.boolean(), timeoutMs: z.number().int().positive().optional() }),
  todos: z.object({ enabled: z.boolean() }),
  skills: z.object({ dir: z.string() }),
  subagents: z.array(subagentSchema).optional(),
  permissions: z
    .object({
      deny: z.array(z.string()).optional(),
      extraAllowRoots: z.array(z.string()).optional(),
      disableDefaultDeny: z.boolean().optional(),
      execute: z.object({ allow: z.array(z.string()).optional(), deny: z.array(z.string()).optional() }).optional(),
    })
    .optional(),
  mcp: z.object({ servers: z.array(mcpServerSchema) }),
  observability: z.object({
    trajectoryFile: z.string().optional(),
    logLevel: z.enum(["trace", "debug", "info", "warn", "error"]),
  }),
});

export type CliConfig = z.infer<typeof CliConfigSchema>;

export interface LoadCliConfigOptions {
  path: string;
}

/** Parse and validate a CLI-owned JSON or YAML configuration file. */
export async function loadCliConfig(opts: LoadCliConfigOptions): Promise<CliConfig> {
  const raw = readFileSync(opts.path, "utf-8");
  const ext = opts.path.split(".").pop()?.toLowerCase();
  return CliConfigSchema.parse(ext === "json" ? JSON.parse(raw) : yaml.load(raw));
}
