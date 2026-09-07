/**
 * roxy-agent-runtime public framework entry point.
 *
 * Hosts construct an AgentDefinition from their own configuration, dependency
 * container, storage policy, and transport adapters, then call
 * AgentRuntime.create().
 */
export * from './core/interfaces.ts'
export * from './core/errors.ts'

export { AgentRuntime } from './runtime/runtime.ts'

export { createLogger } from './logging/logger.ts'
export { InMemoryTrajectoryRecorder, JsonlTrajectoryRecorder } from './observability/trajectory.ts'
export {
  AnthropicProvider,
  DeepseekProvider,
  FakeProvider,
  OpenAIResponsesProvider,
  chatResponse,
} from './provider/provider.ts'
export type { OpenAIResponsesProviderOptions } from './provider/openai_responses.ts'
export { ToolRegistry } from './tools/registry.ts'
export { ToolExecutor } from './tools/executor.ts'
export { SkillRegistry } from './skills/registry.ts'
export { loadSkillBody, scanSkills, scanSkillsWithDiagnostics, validateSkillFile } from './skills/manifest.ts'
export { renderSkillCatalog } from './skills/prompt.ts'
export { McpClient, McpServerRegistry, mcpToolName, mcpToolNamePrefix } from './mcp/index.ts'
export { InMemoryProvider } from './memory/memory.ts'
export { JsonlSessionStore } from './memory/session_store.ts'
export { replayIntoMemory } from './memory/replay.ts'
export { assistantItemsToContent, assistantItemsToMessage, assistantMessageToItems } from './transcript/items.ts'
export {
  NullClarificationHandler,
  ScriptedClarificationHandler,
  SuspendingClarificationHandler,
} from './clarification/handler.ts'
export { BackgroundSummarizer, buildSystemPrompt } from './memory/summarizer.ts'
export { StrictHitlHandler, DelegateHitlHandler, FullAccessHandler } from './hitl/handler.ts'
export { toolNeedsHumanApproval } from './hitl/policy.ts'
export { SubAgentRegistry } from './subagent/registry.ts'
export { AgentManager, AgentManagerError } from './subagent/agent-manager.ts'
export { metricsPlugin } from './plugins/metrics_plugin.ts'
export { CommandPermissions } from './tools/builtin/command_permissions.ts'
export { registerBuiltinTools } from './tools/builtin/index.ts'
export {
  APPLY_PATCH_TOOL_DESCRIPTION,
  applyPatchInputSchema,
  applyPatchTool,
  normalizeApplyPatchInput,
  parseApplyPatch,
} from './tools/builtin/apply_patch.ts'
export type { ApplyPatchInput, ParsedApplyPatchOperation } from './tools/builtin/apply_patch.ts'
export { spawnAgentTool } from './tools/builtin/spawn-agent.ts'
export { listAgentsTool } from './tools/builtin/list-agents.ts'
export { waitAgentTool } from './tools/builtin/wait-agent.ts'
export { PathPermissions } from './tools/builtin/permissions.ts'
export { defineTool, formatToolInputError, jsonSchemaToZod, zodToJsonSchema } from './tools/schema.ts'
export type { ToolDefinitionOptions } from './tools/schema.ts'
