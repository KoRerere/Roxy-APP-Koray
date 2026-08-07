/**
 * roxy-agent-runtime public framework entry point.
 *
 * Hosts construct an AgentDefinition from their own configuration, dependency
 * container, storage policy, and transport adapters, then call
 * AgentRuntime.create().
 */
export * from "./core/interfaces.ts";
export * from "./core/errors.ts";

export { AgentRuntime } from "./runtime/runtime.ts";

export { createLogger } from "./logging/logger.ts";
export { InMemoryTrajectoryRecorder, JsonlTrajectoryRecorder } from "./observability/trajectory.ts";
export { AnthropicProvider, DeepseekProvider, FakeProvider, OpenAIResponsesProvider } from "./provider/provider.ts";
export type { OpenAIResponsesProviderOptions, OpenAIResponsesTurnState } from "./provider/openai_responses.ts";
export { ToolRegistry } from "./tools/registry.ts";
export { ToolExecutor } from "./tools/executor.ts";
export { SkillRegistry } from "./skills/registry.ts";
export { loadSkillBody, scanSkills, scanSkillsWithDiagnostics, validateSkillFile } from "./skills/manifest.ts";
export { renderSkillCatalog, skillCatalogBudgetChars } from "./skills/prompt.ts";
export { McpClient, McpServerRegistry } from "./mcp/index.ts";
export { InMemoryProvider } from "./memory/memory.ts";
export { JsonlSessionStore } from "./memory/session_store.ts";
export { replayIntoMemory } from "./memory/replay.ts";
export {
  NullClarificationHandler,
  ScriptedClarificationHandler,
  SuspendingClarificationHandler,
} from "./clarification/handler.ts";
export { BackgroundSummarizer, buildSystemPrompt } from "./memory/summarizer.ts";
export { StrictHitlHandler, DelegateHitlHandler, FullAccessHandler } from "./hitl/handler.ts";
export { SubAgentManager } from "./subagent/manager.ts";
export { SubAgentRegistry } from "./subagent/registry.ts";
export { SubAgentDispatcher } from "./subagent/dispatcher.ts";
export { metricsPlugin } from "./plugins/metrics_plugin.ts";
export { CommandPermissions } from "./tools/builtin/command_permissions.ts";
