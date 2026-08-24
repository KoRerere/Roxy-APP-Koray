# tools

## 1. 模块职责

统一注册、按名解析、投影为 Anthropic tool 定义，并在沙箱里执行工具 —— 所有失败路径以 `ToolResult{isError}` 返回而非抛出，保证 agent loop 不死。

## 2. 对外暴露的接口

类型来源：`src/core/interfaces.ts`。

- `ToolRegistry implements IToolRegistry`（`src/tools/registry.ts`）— `add` / `remove` / `resolve` / `all` / `toAnthropicTools`。
- `ToolExecutor implements ToolExecutor`（`src/tools/executor.ts`）— `execute(name, input, ctx, toolUseId)`。
- `defineTool(options): ToolDefinition`（`src/tools/schema.ts`）— 用必填 Zod schema 定义工具，并为直接调用提供同一套校验。
- `zodToJsonSchema(schema): JsonSchema`（`src/tools/schema.ts`）— Zod 4 → provider-facing JSON Schema，无法表达的类型直接抛错（不静默回退）。
- `jsonSchemaToZod(schema): ZodType`（`src/tools/schema.ts`）— MCP 等协议边界的 JSON Schema → 强制 Zod 契约，转换失败直接抛错。
- `registerBuiltinTools(): BuiltinTool[]`（`src/tools/builtin/index.ts`）— 返回 `{ descriptor, handler }` 列表，供 runtime 注入。
- `BuiltinTool`：`{ descriptor: ToolDescriptor; handler: ToolHandler }`。

相关契约类型：`ToolDescriptor`、`ToolAnnotations`、`ToolHandler`、`ToolHandlerResult`、`ToolResult`、`ToolContext`、`AnthropicTool`、`JsonSchema`、`ToolSource`。

`ToolDescriptor` 附加字段：

- `kind?: "function" | "custom"` — 默认是 JSON object function tool；custom 工具使用自由文本输入，并从 Anthropic function tool 投影中排除。
- `annotations?: ToolAnnotations` — 标准 MCP 工具注解；HITL 默认审批策略只读取该字段，不读取自定义 metadata 风险标记。
- `previewFn?: (input: unknown) => string | undefined` — HITL 预审批预览生成函数，结果填入 `ApprovalRequest.diff`。`write_file` / `edit_file` 显示 unified diff，`apply_patch` 显示原始 V4A patch。

## 3. 数据示例

### 3.1 内置工具列表

| 工具           | ToolAnnotations                                 | 特性                                                                                          |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ls`           | `readOnlyHint: true`, `openWorldHint: false`    | 目录读取；path-gated；cap-bounded                                                             |
| `read_file`    | `readOnlyHint: true`, `openWorldHint: false`    | UTF-8 文本读取；DSH envelope；1-based `offset` + `limit` 分页；大文件流式读取                 |
| `write_file`   | `destructiveHint: true`, `openWorldHint: false` | 默认写入工具；HITL unified diff 预览                                                          |
| `edit_file`    | `destructiveHint: true`, `openWorldHint: false` | 默认精确替换工具；支持 multi-edit 与 HITL unified diff 预览                                   |
| `apply_patch`  | `destructiveHint: true`, `openWorldHint: false` | 仅 Responses `customToolNames` 启用时注册；DeepSeek V4A patch；HITL patch 预览                |
| `glob`         | `readOnlyHint: true`, `openWorldHint: false`    | `max_results`+`offset` 分页，footer 显示总数与下一页 hint                                     |
| `grep`         | `readOnlyHint: true`, `openWorldHint: false`    | `max_results`+`offset` 分页（content 模式按匹配行，files_with_matches 模式按文件）            |
| `exec_command` | `destructiveHint: true`, `openWorldHint: true`  | Codex 风格 shell 执行，`CommandPermissions` 命令级权限（deny > 安全命令链校验 > allow > ask） |
| `write_stdin`  | `destructiveHint: true`, `openWorldHint: true`  | 轮询后台 `exec_command` session 输出；非 PTY stdin 写入暂不支持                               |
| `ask_user`     | `readOnlyHint: true`, `openWorldHint: false`    | 真实澄清通道                                                                                  |
| `update_plan`  | `readOnlyHint: true`, `openWorldHint: false`    | 无状态完整快照；通过 `ToolContext.emit` 发出 `plan_updated`                                   |

### 3.2 ToolDefinition 示例（builtin，可破坏但不访问外部世界）：

```ts
const applyPatch = defineTool({
  name: 'apply_patch',
  description: 'Apply a V4A patch.',
  kind: 'custom',
  inputSchema: z.string().min(1),
  source: 'builtin',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async (patch) => ({ content: patch, isError: false }),
})
```

Responses Provider 在 `customToolNames` 包含 `apply_patch` 时使用 DeepSeek 兼容的唯一 custom tool，不生成 `parameters` 或 `format`：

```jsonc
{ "type": "custom", "name": "apply_patch", "description": "Apply a V4A patch." }
```

DeepSeek 的自由文本调用在 runtime 内始终保持原始 patch 字符串，解析器只在预览、事件分类和执行时读取 V4A 文件操作。

`zodToJsonSchema` 输入/输出（`z.strictObject({ path: z.string(), n: z.number().optional() })`）：

```jsonc
{ "type": "object", "properties": { "path": { "type": "string" }, "n": { "type": "number" } }, "required": ["path"] }
```

## 4. 调用时序与异常语义

时序：

1. 启动期：runtime 调 `registerBuiltinTools()`，逐个 `registry.add(descriptor, handler)`；skills / MCP 工具按各自路径并入同一 `ToolRegistry`。
2. 每轮模型回合前：runtime 将 `registry.all()` 塞进 `ChatRequest.tools`，由 provider 按 `kind` 投影协议格式。
3. 模型产出 `tool_use` 块后：runtime 取 `block.name` + `block.id`，调 `executor.execute(block.name, block.input, ctx, block.id)`；executor 先执行 Zod `safeParseAsync`，只把解析后的值（含 default/transform）传给 handler。
4. 拿到 `ToolResult` → 拼成 `tool_result` 块回灌下一轮 `messages`。

**永不 reject 契约**（`ToolExecutor.execute`，来源 `interfaces.ts:279-298` 与契约测试 `test/tools/registryExecutor.contract.test.ts:79-134`）：

- 未知工具名 → 返回 `errorKind: "not_found"`，绝不抛。
- Zod 校验失败 → 返回 `errorKind: "input_invalid"`，handler 不会执行。
- handler 抛错 → 返回 `errorKind: "handler_error"`；非 `Error` 对象用 `String(err)`。
- handler 在 `ctx.signal` 已 abort 时抛错 → 返回 `errorKind: "aborted"`（abort 优先于异常消息）。
- handler 正常返回 → 原样透传 `{ content, isError }`，executor 只补上 `toolUseId`（测试 `:106-119`）。

**`IToolRegistry.add` 名字冲突**（`interfaces.ts:251-258`）：冲突判定键是完整的 `descriptor.name`，**不是** `{source}.{name}`。MCP Client 会先把远端工具统一命名为 `mcp_{server-name}__{tool-name}`，因此不同 server 的同名工具以及普通 builtin 默认不会互相覆盖；只有完整名称相同时，新条目才覆盖旧条目、丢弃旧 handler 并记录 warning（测试 `:55-62`：warn 文本 `expect.stringContaining("collision")`，全量仅剩 1 条）。

## 5. 协议映射

### `inputSchema` ↔ Anthropic `input_schema`

`ToolDescriptor.inputSchema`（`ZodType`）在 `toAnthropicTools()` 先转换为 JSON Schema，再投影为 `AnthropicTool.input_schema`（snake_case）：

- Zod 是本地工具唯一真源；本地注册接口不接受手写 JSON Schema。
- JSON Schema 只存在于 Anthropic、OpenAI、MCP 等协议边界。

### `toAnthropicTools` 规则

- function 工具投影为 Anthropic `input_schema`；custom 自由文本工具不发送给 Anthropic provider。
- 投影输出字段：`{ name, description, input_schema }`；**不得**包含 `inputSchema`、`source`、`metadata`（测试 `:64-76` 显式断言 `[0]` 不含 `inputSchema`）。
- 完整名称冲突后，投影列表里该名只出现一次（覆盖后胜者），并在覆盖时 warn。

### zod → JsonSchema（`src/tools/schema.ts`）

使用 Zod 4 原生 `z.toJSONSchema(..., { io: "input", unrepresentable: "throw" })`。default、description、strict object、union 和数值约束均由 Zod 统一生成；无法表达的构造直接抛错，调用方必须修正 schema。

## 6. 验收标准

绑定 `test/tools/registryExecutor.contract.test.ts`（生产实现需满足同等断言，参考实现见 `test/helpers/miniToolRegistry.ts`）：

- `:38-46` `add` + `resolve` + `all`：能解析已注册、`undefined` 解析未知名、`all()` 名称集合正确。
- `:48-53` `remove` 后 `resolve` 返回 `undefined`。
- `:55-62` 完整名称冲突：覆盖 + warn 含 `"collision"`，`all().length === 1`。
- `:64-76` `toAnthropicTools()` 投影为 `{ name, description, input_schema }`，且不暴露 `inputSchema`/`source`/`metadata`。
- `:80-89` 未知工具名 → `{ toolUseId, content: "tool not found: ghost", isError: true }`，不抛。
- `:91-104` handler 抛 `"kaboom"` → `{ isError:true, content:"kaboom", toolUseId:"tu-2" }`，不抛。
- `:106-119` handler 成功返回 → 透传 `{ content:"payload", isError:false }` 并补 `toolUseId:"tu-3"`。
- `:121-134` `signal` abort 且 handler 抛错 → `{ toolUseId:"tu-4", content:"aborted", isError:true }`（abort 优先于 error message）。

额外（无测试但契约要求）：`zodToJsonSchema` 对支持子集精确映射、对越界类型抛错；`registerBuiltinTools` 返回的每个本地工具 `descriptor.annotations` 正确标注读写、破坏性与 open-world 行为（供 HITL `delegate` 模式判定）。MCP 工具同样使用标准 `descriptor.annotations`。

联网搜索由 OpenAI Responses API / DeepSeek Responses API 的服务端
`{ type: "web_search" }` 工具提供，runtime 不注册本地 `web_fetch` 工具。

## 7. 边界用例 / 不做清单（v1 out of scope）

- 不做工具级权限/隐藏（敏感性仅驱动 HITL，不改变 `toAnthropicTools` 可见性）。
- 不做自动重试或超时（由 `ctx.signal` 协作式取消，超时由 runtime 设置 signal）。
- 不允许 handler 各自实现结构校验；executor 对所有注册工具统一执行 Zod 校验，handler 只处理解析后的值和业务约束。
- `glob` / `grep` 分页由工具自身通过 `max_results`+`offset` 参数实现；executor 层不做额外截断。
- 不提供不可表示 schema 的宽松 fallback；转换失败必须在工具定义处修复。
- 不做工具版本化（同名即覆盖）。
- 不做内置工具的并行执行（executor 单工具调度，并行由 runtime 在多 tool_use 块层调度）。
