# tools

## 1. 模块职责

统一注册、按名解析、投影为 Anthropic tool 定义，并在沙箱里执行工具 —— 所有失败路径以 `ToolResult{isError}` 返回而非抛出，保证 agent loop 不死。

## 2. 对外暴露的接口

类型来源：`src/core/interfaces.ts`。

- `ToolRegistry implements IToolRegistry`（`src/tools/registry.ts`）— `add` / `remove` / `resolve` / `all` / `toAnthropicTools`。
- `ToolExecutor implements ToolExecutor`（`src/tools/executor.ts`）— `execute(name, input, ctx, toolUseId)`。
- `zodToJsonSchema(schema): JsonSchema`（`src/tools/schema.ts`）— 受限 zod 子集 → `JsonSchema`，越界类型抛错（不静默回退）。
- `registerBuiltinTools(): BuiltinTool[]`（`src/tools/builtin/index.ts`）— 返回 `{ descriptor, handler }` 列表，供 runtime 注入。
- `BuiltinTool`：`{ descriptor: ToolDescriptor; handler: ToolHandler }`。

相关契约类型：`ToolDescriptor`、`ToolHandler`、`ToolHandlerResult`、`ToolResult`、`ToolContext`、`AnthropicTool`、`JsonSchema`、`ToolSource`。

`ToolDescriptor` 附加字段：

- `previewFn?: (input: unknown) => string | undefined` — HITL 预审批预览生成函数，结果填入 `ApprovalRequest.diff`。`write_file` 和 `edit_file` 提供 unified diff 实现；无此字段则 `diff` 为 `undefined`。

## 3. 数据示例

### 3.1 内置工具列表

| 工具 | sensitive | 特性 |
| ---- | --------- | ---- |
| `ls` | false | — |
| `read_file` | false | — |
| `write_file` | true | HITL diff 预览（previewFn） |
| `edit_file` | true | multi-edit 原子写，HITL diff 预览（previewFn） |
| `glob` | false | `max_results`+`offset` 分页，footer 显示总数与下一页 hint |
| `grep` | false | `max_results`+`offset` 分页（content 模式按匹配行，files_with_matches 模式按文件） |
| `execute` | true | `CommandPermissions` 命令级权限（deny > compound > allow > ask） |
| `web_fetch` | false | — |
| `ask_user` | false | 真实澄清通道 |
| `todo_write` | false | 无状态完整快照；通过 `ToolContext.emit` 发出 `todo_updated` |

### 3.2 ToolDescriptor 示例（builtin，标敏感）：

```jsonc
{
  "name": "write_file",
  "description": "write text to a file",
  "inputSchema": {
    "type": "object",
    "properties": { "path": { "type": "string" }, "content": { "type": "string" } },
    "required": ["path", "content"],
  },
  "source": "builtin",
  "metadata": { "sensitive": true },
}
```

`toAnthropicTools()` 的投影结果（注意 `input_schema` 与无 `inputSchema`/无 `source`/无 `metadata`）：

```jsonc
[
  {
    "name": "write_file",
    "description": "write text to a file",
    "input_schema": {
      "type": "object",
      "properties": { "path": { "type": "string" }, "content": { "type": "string" } },
      "required": ["path", "content"],
    },
  },
]
```

handler 与执行结果：

```ts
const handler: ToolHandler = async (input, ctx) => {
  // 校验 input（如用 zod），执行，检查 ctx.signal.aborted
  return { content: "ok", isError: false }; // ToolHandlerResult
};
// executor 回填 toolUseId → ToolResult
```

`zodToJsonSchema` 输入/输出（`z.object({ path: z.string(), n: z.number().optional() })`）：

```jsonc
{ "type": "object", "properties": { "path": { "type": "string" }, "n": { "type": "number" } }, "required": ["path"] }
```

## 4. 调用时序与异常语义

时序：

1. 启动期：runtime 调 `registerBuiltinTools()`，逐个 `registry.add(descriptor, handler)`；skills / MCP 工具按各自路径并入同一 `ToolRegistry`。
2. 每轮模型回合前：runtime 调 `registry.toAnthropicTools()` 得到工具列表塞进 `ChatRequest.tools`。
3. 模型产出 `tool_use` 块后：runtime 取 `block.name` + `block.id`，调 `executor.execute(block.name, block.input, ctx, block.id)`。
4. 拿到 `ToolResult` → 拼成 `tool_result` 块回灌下一轮 `messages`。

**永不 reject 契约**（`ToolExecutor.execute`，来源 `interfaces.ts:279-298` 与契约测试 `test/tools/registryExecutor.contract.test.ts:79-134`）：

- 未知工具名 → 返回 `{ toolUseId, content: "tool not found: <name>", isError: true }`，绝不抛（测试 `:80-89`：`"tool not found: ghost"`）。
- handler 抛错 → 返回 `{ toolUseId, content: <Error.message>, isError: true }`（测试 `:91-104`：抛 `"kaboom"` → content `"kaboom"`）。非 `Error` 对象用 `String(err)`。
- handler 在 `ctx.signal` 已 abort 时抛错 → 返回 `{ toolUseId, content: "aborted", isError: true }`（abort 优先于 message，测试 `:121-134`）。
- handler 正常返回 → 原样透传 `{ content, isError }`，executor 只补上 `toolUseId`（测试 `:106-119`）。

**`IToolRegistry.add` 名字冲突**（`interfaces.ts:251-258`）：冲突判定键是**用户可见的短名**（`descriptor.name`），**不是** `{source}.{name}`。即同名 builtin 与 MCP 工具冲突。冲突时新条目覆盖旧的，旧 handler 丢弃，并记一条 warning（测试 `:55-62`：warn 文本 `expect.stringContaining("collision")`，全量仅剩 1 条）。

## 5. 协议映射

### `inputSchema` ↔ Anthropic `input_schema`

`ToolDescriptor.inputSchema`（`JsonSchema`，camelCase）在 `toAnthropicTools()` 投影为 `AnthropicTool.input_schema`（snake_case）：

- `inputSchema` → `input_schema`（键名重命名，值原样透传，不做语义改写）。
- `JsonSchema` 是 Anthropic 接受的 JSON Schema 子集：`type` / `description` / `properties` / `required` / `items` / `enum` / `oneOf` / `anyOf` / `additionalProperties`。

### `toAnthropicTools` 规则

- 每个已注册工具都暴露（无敏感/只读过滤 —— 敏感性是 HITL 关注点，不是工具隐藏开关，见 `interfaces.ts:265-270` 注释 "Excludes nothing"）。
- 投影输出字段：`{ name, description, input_schema }`；**不得**包含 `inputSchema`、`source`、`metadata`（测试 `:64-76` 显式断言 `[0]` 不含 `inputSchema`）。
- 短名冲突后，投影列表里该名只出现一次（覆盖后胜者），并在覆盖时 warn。

### zod → JsonSchema（`src/tools/schema.ts`）

受限映射，越界即抛（不静默回退）；想要自定义 schema 时直接在 `ToolDescriptor.inputSchema` 上手写 `JsonSchema`。映射表见 `interfaces.ts:182-193` JSDoc：`z.string/number/boolean`→`{type}`、`z.array(T)`→`{type:"array",items}`、`z.object`→`{type:"object",properties,required}`、`z.enum`→`{type:"string",enum}`、`z.union`→`{anyOf}`、`.optional()`→从 `required` 移除、`.describe(s)`→`{description}`。

## 6. 验收标准

绑定 `test/tools/registryExecutor.contract.test.ts`（生产实现需满足同等断言，参考实现见 `test/helpers/miniToolRegistry.ts`）：

- `:38-46` `add` + `resolve` + `all`：能解析已注册、`undefined` 解析未知名、`all()` 名称集合正确。
- `:48-53` `remove` 后 `resolve` 返回 `undefined`。
- `:55-62` 短名冲突：覆盖 + warn 含 `"collision"`，`all().length === 1`。
- `:64-76` `toAnthropicTools()` 投影为 `{ name, description, input_schema }`，且不暴露 `inputSchema`/`source`/`metadata`。
- `:80-89` 未知工具名 → `{ toolUseId, content: "tool not found: ghost", isError: true }`，不抛。
- `:91-104` handler 抛 `"kaboom"` → `{ isError:true, content:"kaboom", toolUseId:"tu-2" }`，不抛。
- `:106-119` handler 成功返回 → 透传 `{ content:"payload", isError:false }` 并补 `toolUseId:"tu-3"`。
- `:121-134` `signal` abort 且 handler 抛错 → `{ toolUseId:"tu-4", content:"aborted", isError:true }`（abort 优先于 error message）。

额外（无测试但契约要求）：`zodToJsonSchema` 对支持子集精确映射、对越界类型抛错；`registerBuiltinTools` 返回的每个 `descriptor.metadata.sensitive` 正确标注写/联网类工具（供 HITL `delegate` 模式判定）。

## 7. 边界用例 / 不做清单（v1 out of scope）

- 不做工具级权限/隐藏（敏感性仅驱动 HITL，不改变 `toAnthropicTools` 可见性）。
- 不做自动重试或超时（由 `ctx.signal` 协作式取消，超时由 runtime 设置 signal）。
- 不做工具参数服务端校验兜底 —— handler 自校验 `input`；executor 透传 `unknown`。
- `glob` / `grep` 分页由工具自身通过 `max_results`+`offset` 参数实现；executor 层不做额外截断。
- `zodToJsonSchema` 不支持 `z.discriminatedUnion` / `z.intersection` / `z.record` / `z.tuple` 等高阶构造（需用手写 `inputSchema`）。
- 不做工具版本化（同名即覆盖）。
- 不做内置工具的并行执行（executor 单工具调度，并行由 runtime 在多 tool_use 块层调度）。
