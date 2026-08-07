import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  AgentRuntime,
  AnthropicProvider,
  BackgroundSummarizer,
  DeepseekProvider,
  FakeProvider,
  FullAccessHandler,
  InMemoryProvider,
  InMemoryTrajectoryRecorder,
  JsonlSessionStore,
  NullClarificationHandler,
  StrictHitlHandler,
  DelegateHitlHandler,
  SubAgentDispatcher,
  SubAgentRegistry,
  ToolRegistry,
} from "../index.ts";
import type {
  Agent,
  AgentDefinition,
  AgentLifecycleHooks,
  IClarificationHandler,
  IHITLHandler,
  ILogger,
  IModelProvider,
  SkillManifest,
  RoxyPlugin,
  SubAgentSpec,
  ToolDescriptor,
  ToolHandler,
} from "../core/interfaces.ts";
import { SkillRegistry } from "../skills/registry.ts";
import { CommandPermissions } from "../tools/builtin/command_permissions.ts";
import { registerBuiltinTools } from "../tools/builtin/index.ts";
import { createEvictionMiddleware } from "../tools/builtin/middleware/eviction.ts";
import { PathPermissions } from "../tools/builtin/permissions.ts";
import { taskTool } from "../tools/builtin/task.ts";
import type { CliConfig } from "./config.ts";

export interface CreateCliAgentOptions {
  sessionId?: string;
  hooks?: AgentLifecycleHooks;
  tools?: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>;
  workdir?: string;
  clarification?: IClarificationHandler;
  plugins?: RoxyPlugin[];
  logger: ILogger;
}

type CliProviderConfig = CliConfig["provider"];

/**
 * CLI-only adapter from its serialized configuration to framework instances.
 * Environment resolution, filesystem defaults, builtin tooling, and provider
 * selection intentionally live here rather than in the runtime package entry.
 */
export async function createCliAgent(config: CliConfig, opts: CreateCliAgentOptions): Promise<Agent> {
  const sessionId = opts.sessionId ?? randomUUID();
  const { logger } = opts;
  const skills = await loadSkills(config.skills.dir, logger);
  const skillRoots = skills.map((skill) => skill.sourcePath);
  const sessionStore = config.sessions.enabled ? new JsonlSessionStore({ dir: config.sessions.dir }) : undefined;
  const commandPermissions = config.permissions?.execute
    ? new CommandPermissions(config.permissions.execute)
    : undefined;
  const hitl = createCliHitl(config, commandPermissions);
  const subagentConfigs = new Map((config.subagents ?? []).map((spec) => [spec.name, spec]));
  const subagentSpecs: SubAgentSpec[] = (config.subagents ?? []).map(
    ({ name, description, systemPrompt, tools, maxTokens }) => ({
      name,
      description,
      systemPrompt,
      ...(tools ? { tools } : {}),
      ...(maxTokens ? { maxTokens } : {}),
    }),
  );
  const subagentRegistry = new SubAgentRegistry(subagentSpecs);

  const build = async (params: {
    childSessionId: string;
    providerConfig: CliProviderConfig;
    model: string;
    maxTokens: number;
    systemPrompt?: string;
    toolAllowlist?: string[];
    clarification?: IClarificationHandler;
    hooks?: AgentLifecycleHooks;
    task?: { dispatcher: SubAgentDispatcher; specs: SubAgentSpec[] };
    plugins?: RoxyPlugin[];
    onDispose?: () => void | Promise<void>;
  }): Promise<Agent> => {
    const provider = createCliProvider(params.providerConfig);
    const tools = createCliTools({
      config,
      hitl,
      commandPermissions,
      skillRoots,
      workdir: opts.workdir,
      clarification: params.clarification,
      extraTools: opts.tools,
      toolAllowlist: params.toolAllowlist,
      task: params.task,
    });
    const definition: AgentDefinition = {
      sessionId: params.childSessionId,
      model: params.model,
      maxTokens: params.maxTokens,
      systemPrompt: params.systemPrompt,
      provider,
      memory: new InMemoryProvider(),
      tools,
      hitl,
      recorder: new InMemoryTrajectoryRecorder(),
      logger,
      trimPolicy: config.memory.trim,
      contextWindowTokens: config.memory.contextWindowTokens,
      triggerTokens: config.memory.triggerTokens,
      middleware: [
        createEvictionMiddleware({ scratchDir: join(tmpdir(), "roxy", params.childSessionId, "tool-results") }),
      ],
      ...(params.clarification ? { clarification: params.clarification } : {}),
      ...(params.hooks ? { hooks: params.hooks } : {}),
      ...(params.plugins ? { plugins: params.plugins } : {}),
      ...(config.memory.summarize ? { summarizer: new BackgroundSummarizer(provider, params.model) } : {}),
      ...(sessionStore ? { sessionStore } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(params.onDispose ? { onDispose: params.onDispose } : {}),
    };
    return AgentRuntime.create(definition);
  };

  const dispatcher = new SubAgentDispatcher(
    subagentRegistry,
    (spec, childSessionId) => {
      const childConfig = subagentConfigs.get(spec.name);
      const providerConfig = childConfig?.provider ?? config.provider;
      return build({
        childSessionId,
        providerConfig,
        model: providerConfig.model,
        maxTokens: spec.maxTokens ?? providerConfig.maxTokens,
        systemPrompt: spec.systemPrompt,
        toolAllowlist: spec.tools,
      });
    },
    sessionId,
    {
      onDelegate: sessionStore
        ? async (name, childSessionId) => {
            await sessionStore.append(sessionId, { type: "subagent_delegated", childSessionId, name, ts: Date.now() });
          }
        : undefined,
    },
  );

  const clarification = config.clarification.enabled
    ? (opts.clarification ?? new NullClarificationHandler())
    : undefined;
  return build({
    childSessionId: sessionId,
    providerConfig: config.provider,
    model: config.provider.model,
    maxTokens: config.provider.maxTokens,
    systemPrompt: config.system.systemPrompt,
    hooks: opts.hooks,
    plugins: opts.plugins,
    clarification,
    ...(subagentSpecs.length > 0
      ? { task: { dispatcher, specs: subagentSpecs }, onDispose: () => dispatcher.disposeAll() }
      : {}),
  });
}

function createCliProvider(config: CliProviderConfig): IModelProvider {
  if (config.id === "fake") return new FakeProvider();
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`CLI provider API key is missing: ${config.apiKeyEnv}`);
  if (config.id === "deepseek") {
    return new DeepseekProvider({
      apiKey,
      model: config.model,
      baseURL: config.baseURL,
      ...(config.defaultHeaders ? { defaultHeaders: config.defaultHeaders } : {}),
      ...(config.contextWindowTokens ? { contextWindowTokens: config.contextWindowTokens } : {}),
    });
  }
  return new AnthropicProvider({
    apiKey,
    model: config.model,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(config.defaultHeaders ? { defaultHeaders: config.defaultHeaders } : {}),
    ...(config.contextWindowTokens ? { contextWindowTokens: config.contextWindowTokens } : {}),
    ...(config.thinking ? { thinking: config.thinking } : {}),
    ...(config.promptCaching !== undefined ? { promptCaching: config.promptCaching } : {}),
  });
}

function createCliHitl(config: CliConfig, commandPermissions?: CommandPermissions): IHITLHandler {
  const options = commandPermissions ? { commandPermissions } : {};
  if (config.hitl.mode === "full") return new FullAccessHandler();
  if (config.hitl.mode === "strict") return new StrictHitlHandler(false, options);
  return new DelegateHitlHandler(config.hitl.rules ?? [], options);
}

function createCliTools(opts: {
  config: CliConfig;
  hitl: IHITLHandler;
  commandPermissions?: CommandPermissions;
  skillRoots: string[];
  workdir?: string;
  clarification?: IClarificationHandler;
  extraTools?: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>;
  toolAllowlist?: string[];
  task?: { dispatcher: SubAgentDispatcher; specs: SubAgentSpec[] };
}): ToolRegistry {
  const registry = new ToolRegistry();
  const allowed = opts.toolAllowlist ? new Set(opts.toolAllowlist) : undefined;
  const permissionConfig = opts.config.permissions;
  const allowRoots = [
    ...(opts.workdir ? [opts.workdir] : []),
    ...opts.skillRoots,
    ...resolveRoots(opts.workdir, permissionConfig?.extraAllowRoots),
  ];
  const permissions =
    allowRoots.length > 0 || permissionConfig
      ? new PathPermissions({
          allowRoots,
          extraDeny: permissionConfig?.deny,
          disableDefaultDeny: permissionConfig?.disableDefaultDeny,
        })
      : undefined;
  for (const tool of registerBuiltinTools({
    enableTodos: opts.config.todos.enabled,
    ...(opts.clarification ? { clarificationHandler: opts.clarification } : {}),
    ...(permissions ? { permissions } : {}),
    ...(opts.commandPermissions ? { commandPermissions: opts.commandPermissions } : {}),
    hitl: opts.hitl,
  })) {
    if (!allowed || allowed.has(tool.descriptor.name)) registry.add(tool.descriptor, tool.handler);
  }
  for (const tool of opts.extraTools ?? []) {
    if (!allowed || allowed.has(tool.descriptor.name)) registry.add(tool.descriptor, tool.handler);
  }
  if (opts.task) {
    const tool = taskTool(opts.task);
    registry.add(tool.descriptor, tool.handler);
  }
  return registry;
}

async function loadSkills(dir: string, logger: ILogger): Promise<SkillManifest[]> {
  try {
    const registry = new SkillRegistry(dir);
    await registry.scan();
    const skills = registry.list();
    if (skills.length > 0) logger.info("Skills loaded", { count: skills.length });
    return skills;
  } catch (error) {
    logger.debug("Skills dir not loaded - continuing without skills", { dir, error: String(error) });
    return [];
  }
}

function resolveRoots(workdir: string | undefined, roots?: string[]): string[] {
  return (roots ?? []).map((root) => (workdir && !root.startsWith("/") ? resolve(workdir, root) : root));
}
