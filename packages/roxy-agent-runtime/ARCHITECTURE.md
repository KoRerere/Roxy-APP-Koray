# roxy-agent 架构总览

本文档是各模块 README 之上的总纲：模块依赖、边界纪律、完整配置示例、端到端 trace 验收基准、依赖约束。实现 runtime 后以本文 §4 trace 序列作为对账基准。

## 1. 框架总览

roxy-agent 是模块化通用 AI Agent 框架。runtime 内部使用统一的 messages/tools/tool_use/tool_result canonical contract，具体 Anthropic Messages、OpenAI Responses 或用户自定义 wire protocol 由 `IModelProvider` 实现负责转换。内部编排由自研 agent loop 负责，上层是自研接口（`src/core/interfaces.ts`）。面向接口编程、TDD、异步优先。

五大功能模块：动态技能（SKILL.md 模型驱动）、MCP、记忆、HITL、子 Agent；外加基础设施（logging/observability/provider）与编排层（runtime）。

**内置工具：** `ls` / `read_file` / `write_file`（HITL diff 预览）/ `edit_file`（multi-edit 原子写，HITL diff 预览）/ `glob`（max_results+offset 分页）/ `grep`（max_results+offset 分页）/ `execute`（命令级权限 `CommandPermissions`）/ `web_fetch` / `ask_user`（真实澄清通道）/ `todo_write`。

`todo_write` 是无状态的完整快照工具：模型的 tool-call 参数随会话历史持久化，工具通过 `ToolContext.emit` 发出 `todo_updated`，由宿主/UI 保存最新展示状态。runtime 不维护独立 Todo Store。

### 模块依赖图

```
                         ┌──────────────────────────────────────┐
                         │            src/core/interfaces        │  ← 公共契约（零依赖）
                         └──────────────┬───────────────────────┘
            ┌───────────────────────────┼────────────────────────────┐
            ▼                ▼          ▼          ▼            ▼     ▼
       logging        observability  provider               tools   memory
         │                 │            │                    │  ▲    │
         │                 │            │            ┌───────┘  │    │
         │                 │            │      ┌─────▼──┐   skills  │
         │                 │            │      │builtin │   (read_file/execute)
         │                 │            │      └────────┘   │
         │                 │            │            mcp ────┤ (写入 ToolRegistry)
         │                 │            │                    │
         │                 │            │      hitl ◀─── 依据 descriptor.metadata.sensitive
         │                 │            │            │
         └────────┬────────┴────────────┴───┐        │
                  ▼                         ▼        │
              subagent ◀── owns own memory/tools  ◀──┘
                  │
                  ▼
            src/runtime  ◀── 自研 agent loop
            (AgentRuntime → AgentImpl → rollout replay)
                  │
                  ▼
            src/index.ts (AgentRuntime 公共入口)
```

要点：

- `core/interfaces.ts` 被所有模块依赖，自身零依赖。
- 工具来源统一进 `ToolRegistry`：`builtin`、`skill`、`mcp`。Skills 本身不是工具：Catalog 进入 system，隐式匹配用 `read_file`，显式选择用临时 user-role `<skill>`；脚本统一走 `execute`。
- `hitl` 不拥有工具，依据 `ToolDescriptor.metadata.sensitive` 判定是否拦截。
- 每个子 Agent 拥有独立 `IMemoryProvider` 与 `thread_id`。
- `AgentRuntime.create(AgentDefinition)` 只消费宿主构造好的对象图，不解析 JSON/YAML、env 或默认路径，也不替宿主选择 provider、tools、MCP、skills 与 session store。
- 外部记忆系统优先做成 plugin：`api.addMemoryLifecycle()` 负责 turn-end /
  compaction 写入，`api.addContextContributor()` 负责每次 model call 前检索并
  注入 `ChatRequest.system`。
- `src/cli/**` 是随包提供的示例应用 adapter，不属于 framework 公共入口；其中的配置 schema 不会从 `src/index.ts` 导出。

## 2. 边界纪律

- 全局禁用 `pino` / `winston` / `reflect-metadata`（同一边界测试 + oxlint `no-restricted-imports`）。
- 上层只见 `core` 接口；运行时状态形态不泄漏到 runtime 之外的模块。

## 3. 依赖约束

运行时依赖（仅这些 + 其传递依赖 `@langchain/core`，后者永不直接 import）：

- `@anthropic-ai/sdk` — Anthropic messages API。
- `openai` — OpenAI Responses API（也用于 Responses-compatible endpoint）。
- `@modelcontextprotocol/sdk` — MCP client（stdio + StreamableHTTP）。
- `zod` — 工具入参 schema，以及私有 CLI adapter 的输入校验。
- `js-yaml` — SKILL.md frontmatter 与私有 CLI 配置解析。
- `oxfmt` — 代码格式化工具（运行时实际为 dev 用途，随包分发）。

dev 依赖：

- `tsx`（dev 运行器）、`@vitest/coverage-v8`（覆盖率）、`@types/js-yaml`、`@types/node`、`@types/react`、`oxlint`、`typescript`、`vite`、`vitest`、`ink`（CLI Ink 组件）、`react`。

禁用：pino、winston、reflect-metadata（以及任何未在 package.json 声明的库）。其余能力用 Node 24 内置（`node:sqlite`、`node:child_process` 等）。

## 4. 完整 AgentDefinition 示例

```ts
const provider = new AnthropicProvider({
  apiKey: hostSecrets.agentToken,
  model: resolvedModel.name,
  baseURL: resolvedModel.baseURL,
});

const tools = new ToolRegistry();
for (const tool of hostToolCatalog) tools.add(tool.descriptor, tool.handler);

const definition: AgentDefinition = {
  sessionId: run.sessionId,
  model: resolvedModel.name,
  maxTokens: 8192,
  provider,
  memory: new InMemoryProvider(),
  tools,
  hitl: hostHitlHandler,
  recorder: hostTrajectoryRecorder,
  logger: hostLogger,
  sessionStore: hostSessionStore,
  clarification: hostClarificationHandler,
  hooks: hostLifecycleHooks,
};

const agent = await AgentRuntime.create(definition);

const data = await agent
  .structured(z.object({ name: z.string(), activeTasks: z.number() }))
  .invoke("Inspect the customer");
```

宿主可以使用任意配置来源，但必须先完成解析并构造上述实例。framework 不公开 config schema、provider factory 或默认装配器。

## 5. 端到端 trace 验收基准（实现 runtime 后对账）

场景：用 `FakeProvider` 脚本化一轮 `text → tool_use(ls) → hitl(approve) → tool_executed → result_returned → text → end_turn`。期望 `AgentResponse.trajectory` 序列（phase + 关键 data，`ts` 忽略）：

| #   | phase             | data 关键字段                                                         |
| --- | ----------------- | --------------------------------------------------------------------- |
| 1   | `model_thought`   | `{ stopReason: "tool_use" }` 或文本 delta                             |
| 2   | `tool_selected`   | `{ name: "ls", toolUseId: "tu_1", input: { path: "." } }`             |
| 3   | `hitl_intercept`  | `{ toolName: "ls", mode: "delegate"\|"strict", decision: "approve" }` |
| 4   | `tool_executed`   | `{ name: "ls", toolUseId: "tu_1", durationMs }`                       |
| 5   | `result_returned` | `{ toolUseId: "tu_1", isError: false }`                               |
| 6   | `model_thought`   | `{ stopReason: "end_turn" }`（终轮文本）                              |

断言要点：

- `AgentResponse.messages` oldest-first，含 assistant tool_use turn + role:tool 的 tool_result，**不含输入**。
- `trajectory` 为本次调用事件（per-call，非累加）。
- HITL `reject` 时第 3 条 `decision: "reject"` 且 `feedback` 进第 5 条 `tool_result.isError=true/content=feedback`。
- `role: "system"` 永不出现在 `ChatRequest.messages`，由 `ChatRequest.system` 承载（含 `[Archived Context Summary: ...]` 前缀，见 memory README）。

contract 测试锚点：`test/helpers/miniToolRegistry.ts`（工具契约）、`test/helpers/miniTrimmer.ts`（裁剪契约）、`test/skills/invoke.contract.test.ts`（技能契约）、`test/hitl/approvalMatrix.contract.test.ts`（HITL 矩阵）、`test/observability/recorder.contract.test.ts`（轨迹记录器）。生产实现落地后须通过这些断言。

## 6. 实现状态与剩余工作

**已完成（core runtime 全部可用）：**

- `AnthropicProvider`（含 prompt caching、真实 `countTokens` API、`withStructuredOutput`）
- `DeepseekProvider`（Anthropic 兼容面，自动关闭 caching 与 countTokens）
- `OpenAIResponsesProvider`（通用 Responses API；支持 OpenAI、DeepSeek 及兼容 endpoint）
- `AgentRuntime.create` + `.invoke` + `.stream` + `.structured` 公共生命周期接口
- 内部 `AgentImpl.invoke` + `.stream` 完整运行循环（含 usage-driven compaction）
- 所有内置工具（ls/read_file/write_file/edit_file multi-edit/glob/grep/execute/web_fetch/ask_user/todo_write）
- `todo_write` 无状态快照与 `todo_updated` 工具事件转发
- `glob` / `grep` 分页（`max_results` + `offset`，附 footer 提示总数与下一页 offset）
- `write_file` / `edit_file` HITL diff 预览（`ToolDescriptor.previewFn` + unified diff）
- `CommandPermissions`（deny > compound > allow > ask 优先级，glob 匹配，支持运行时 `addAllow`）
- `SuspendingClarificationHandler`（Promise parking，onPending 回调）
- `StrictHitlHandler` / `DelegateHitlHandler` / `FullAccessHandler`
- `DelegateHitlHandler.addRule`（运行时动态插入规则，"永不再问"功能）
- `ApprovalResult.remember`（用户选择 always 时携带 toolPattern/commandPattern）
- `DelegateHitlHandler` 的 `onRuleAdded` 宿主回调
- CLI `HitlConfirm` 支持 `[a]lways` 选项（编辑 pattern，Tab 切字段，Enter 确认）
- `InMemoryProvider`（memory）、`BackgroundSummarizer`、trim policy
- `JsonlSessionStore`（durable rollout）、`replayIntoMemory`
- `McpClient` / `McpServerRegistry`（stdio + StreamableHTTP）
- `SkillRegistry`（严格 scan + diagnostics + XML 外壳/Markdown Catalog + 显式 SkillSelection）
- `SubAgentDispatcher`（named subagents via `task` tool，cached instance）
- Plugin memory lifecycle（`addMemoryLifecycle`：turn-end + compaction 写入）
- `metricsPlugin`（per-turn hooks）
- CLI（Ink App.tsx + ClarifyPrompt + HitlConfirm）

**剩余 stubs（`NotImplementedError`）：**

- `TrajectoryBridge.emit` — `src/runtime/trajectory_bridge.ts`
- `replayTrajectory` — `src/debug/replay.ts`
- `buildSequentialPipeline` / `buildParallelFanOut` — `src/subagent/graphs.ts`
