# core

模块职责：定义整个框架的**公开契约**（接口与类型），零运行时依赖，是所有其他模块的共同依赖。

## 对外暴露的接口

契约按功能位于 `contracts/`，并由 `interfaces.ts` 统一 re-export，兼容现有公共导入路径：

- `contracts/logging.ts` / `observability.ts`：日志与轨迹。
- `contracts/provider.ts`：canonical message 与 `IModelProvider`。
- `contracts/tools.ts` / `skills.ts` / `mcp.ts`：工具、技能与 MCP。
- `contracts/memory.ts` / `context.ts`：会话、rollout、记忆与上下文注入。
- `contracts/hitl.ts` / `clarification.ts` / `todo.ts`：交互式控制与 planning event。
- `contracts/subagent.ts` / `agent.ts`：Agent 主契约、装配定义与子 Agent。
- `contracts/lifecycle.ts` / `plugins.ts`：生命周期观测与扩展机制。

具体类型归属：

- **消息信封**（Provider 中性、Anthropic 形态）：`Role`、`TextBlock`、`ToolUseBlock`、`ToolResultBlock`、`ContentBlock`、`Message`（含 `visible` 与压缩恢复用 `compactionKey` / `compactionOrder`）、`StopReason`、`ToolChoice`、`SystemTextBlock`、`SystemBlock`。
- **Provider 抽象**：`IModelProvider`、`ChatRequest`、`ChatResponse`、`ChatStreamChunk`；`toProviderRequest` / `fromProviderResponse` 为可选协议转换 hook，内置 provider 均实现。
- **工具**：`JsonSchema`、`ToolSource`、`ToolDescriptor`、`ToolHandler`、`ToolContext`、`ToolResult`、`IToolRegistry`、`AnthropicTool`、`ToolCallNormalizer`、`ToolExecutorOptions`、`ToolExecutor`。
- **技能（SKILL.md 模型驱动）**：`SkillManifest`、`SkillDiagnostics`、`SkillSelection`、`ISkillRegistry`。
- **MCP**：`McpTransport`、`McpServerConfig`、`IMcpClient`、`IMcpServerRegistry`。
- **会话持久化（rollout）**：`RolloutEvent`、`ISessionStore`、`SessionMeta`。
- **记忆**：`SessionId`、`TrimMode`、`TrimPolicy`、`TrimSummary`、`IMemoryProvider`、`Trimmer`、`Summarizer`。
- **Planning / Todo**：`PlanStatus`、`PlanItem`、`ToolEvent`。`update_plan` 不保存状态，完整快照通过 tool-call 历史持久化并以 `plan_updated` 事件交给宿主。
- **HITL**：`HitlMode`、`HitlRule`、`ApprovalRequest`、`ApprovalResult`、`IHITLHandler`、`PendingApproval`。
- **Clarification（模型主动问用户）**：`ClarificationRequest`、`ClarificationResult`、`PendingClarification`、`IClarificationHandler`。实现在 `src/clarification/handler.ts`；宿主决定是否注入 handler 与 ask_user 工具。
- **子 Agent**：`SubAgentSpec`、`AgentPath`、`IAgentManager`、`ManagedAgentBuilder`、节点快照、typed manager error 与 spawn/list/wait 契约。
- **Agent**：`AgentInput`、`AgentTurnInput`、`Agent`（含 `invoke(signal?)`、`stream(signal?)`、`resume(traceId, decision)`、`clarify(traceId, result)`、`cancelPending(reason?)`）、`AgentDefinition`、`AgentResponse`、`AgentStreamEvent`（含 `clarification_pending`、`plan_updated`）。
- **可观测性**：`LogLevel`、`ILogger`、`TrajectoryPhase`（含 `clarification_requested`、`skill_invoked`、`plan_updated`）、`TrajectoryEvent`、`ITrajectoryRecorder`。
- **生命周期钩子（外部观测）**：`ToolErrorKind`（`not_found | input_invalid | handler_error | aborted`）；9 个 context 类型（`InvokeBeforeContext`、`InvokeAfterContext`、`InvokeAbortContext`、`ModelBeforeContext`、`ModelFirstTokenContext`、`ModelAfterContext`、`ToolBeforeContext`、`ToolAfterContext`、`StreamChunkContext`）；`AgentLifecycleHooks`（嵌套命名空间：`invoke / model / tool / stream`，所有 hook 均同步，runtime 不 await）。Agent tree 生命周期由 `AgentManagerOptions.onEvent` 观测。
- **上下文注入**：`ContributorContext`、`ContextContribution`、`IContextContributor`（每轮生成一次隐藏 developer message，持久化后用于 RAG / 长期记忆注入）。注入点：`AgentGraphDeps.contributors[]` 或通过 plugin `api.addContextContributor()`。
- **Plugin 系统**：`ToolMiddlewareContext`、`ToolMiddleware`（before/after 洋葱拦截，可修改输入输出或抛错阻断）；`MemoryLifecycle`（长期记忆写入生命周期，含 turn-end 与 compaction）；`AuthRequest`、`AuthToken`（OAuth 交互授权流程）；`PluginSetupContext`、`PluginAPI`（注册能力的入口，含 `registerTools` / `addContextContributor` / `addMemoryLifecycle` / `addHooks` / `addToolMiddleware` / `requestAuth` / `onDispose`）；`RoxyPlugin`（具名能力包，`setup(api)` 回调模式）。注入点：`AgentDefinition.plugins[]`，按声明顺序 setup、在 `Agent.dispose()` 时逆序 teardown。

`core` 不定义 JSON/YAML、环境变量、默认路径或部署配置。它们全部属于宿主，由宿主负责适配并注入 framework。

`errors.ts`：`NotImplementedError`（骨架阶段桩实现统一抛出，便于 grep 定位未完成项）。

## 主要功能点

- 作为框架的"接口宪法"，面向接口编程的基石。
- runtime 使用统一 canonical message；Anthropic Messages、OpenAI Responses 和用户自定义 wire protocol均由对应 `IModelProvider` 转换。`system` 只承载稳定 block；动态宿主上下文使用 `visible: false` 的 developer message 并写入 rollout。
- 工具用统一 `source: 'builtin'|'skill'|'mcp'` 标注来源，便于 HITL 判定与冲突管理。

## 与其他模块的关系

`interfaces.ts` 是稳定公共 barrel；`contracts/*.ts` 之间只允许 `import type`，不产生运行时依赖。`src/runtime/` 是编排实现模块，承担 agent loop 与 rollout replay。

## 实现状态

✅ 接口已定义完整；本模块不含实现（纯类型 + 错误类）。
