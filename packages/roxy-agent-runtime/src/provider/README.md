# provider

## 1. 模块职责

把 runtime 的 canonical `ChatRequest` 转译为具体 API 协议并回传 `ChatResponse` / 流式 chunk。Provider 按协议能力划分，不按模型厂商划分；同一个模型可通过不同协议 Provider 使用，同一个协议 Provider 也可以通过 `baseURL` 服务多个厂商。

`AgentRuntime` 只依赖 `IModelProvider`，不读取 provider 配置，也不创建 provider。宿主直接注入实例：

```ts
const agent = await AgentRuntime.create({
  // ...其余 AgentDefinition 字段
  provider: new AnthropicProvider({ apiKey, model }),
})
```

用户扩展其他协议时只需实现 `IModelProvider`，无需修改 runtime、memory 或 agent loop。
`toProviderRequest` / `fromProviderResponse` 是 optional hook：第三方 provider
可以不实现；本包内置 provider 均实现，用于把 canonical request/response 的协议映射
集中在 provider 内部，并允许测试在不发起网络请求的情况下验证 wire format。

## 2. 对外暴露的接口

类型来源：`src/core/interfaces.ts`。

- `AnthropicProvider implements IModelProvider`（`src/provider/anthropic.ts`）— Anthropic Messages API；可通过 `baseURL` 指向兼容 endpoint。
- `DeepseekProvider implements IModelProvider`（`src/provider/deepseek.ts`）— 保留为 DeepSeek Anthropic API 实现，并处理其缓存、鉴权及 structured output 差异。
- `OpenAIResponsesProvider implements IModelProvider`（`src/provider/openai_responses.ts`）— 通用 Responses API；DeepSeek Responses 通过 `customToolNames: ['apply_patch']` 使用 custom tool。
- `FakeProvider implements IModelProvider`（`src/provider/fake.ts`）— `id === "fake"`；同一接口，纯内存、确定性。
- 所有生产 Provider 的密钥、模型、`baseURL` 和 `defaultHeaders` 都由宿主显式传入；Provider 不读取环境变量。
- `FakeProviderOptions`：`{ responses?: ChatResponse[]; handler?: (req, callIndex) => ChatResponse; tokenCounter?: (messages) => number }`。
- 辅助导出 `chatResponse(message, stopReason?, usage?)` 构造 `ChatResponse`。

### 2.1 Conversion hooks

- `toProviderRequest(req)`：把 runtime 的 `ChatRequest` 转成具体协议请求；例如 Anthropic Messages body 或 OpenAI Responses body。
- `fromProviderResponse(response)`：把具体协议的非流式响应转成 `ChatResponse`。
- 这两个 hook 不参与 runtime agent loop 的必需路径；`invoke` / `stream` 仍是执行入口。
- 流式增量仍通过 `stream` 转成 `ChatStreamChunk`，暂不额外暴露 stream codec。

### 2.2 Roxy transcript items

Responses 是无状态 API，下一轮请求需要回传 reasoning、web search 等 provider-only output item。runtime 不把某个 provider 的 wire item 当主存储，而是先翻译成 Roxy-owned `RoxyAssistantItem`：

- Provider 写入 `ChatResponse.items`，流式终态通过 `message_stop.items` 返回。
- runtime、memory 和 JSONL rollout 保存 Roxy transcript items，而不是 provider state。
- Provider adapter 从 `Message.transcriptItems` 转成自己的 wire request；缺失时才从 canonical content 降级转换。
- items 必须可 JSON 序列化，才能跨进程恢复并支持后续切换 provider。

## 3. 数据示例

一次带 `tool_use` 回合的请求：

```ts
// ChatRequest
{
  "model": "claude-3-5-sonnet-20241022",
  "system": [{ "type": "text", "text": "You are a helpful coding agent." }],
  "messages": [
    { "role": "user", "content": "list the files in /tmp" },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_01ABC",
          "name": "ls",
          "input": { "path": "/tmp" },
        },
      ],
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_01ABC",
          "content": "a.txt\nb.log",
        },
      ],
    },
  ],
  "tools": [
    {
      "name": "ls",
      "description": "list a directory",
      "inputSchema": z.strictObject({ path: z.string() }),
      "source": "builtin",
    },
  ],
  "maxTokens": 1024,
  "temperature": 0.2,
  "toolChoice": "auto",
}
```

provider 返回的 `ChatResponse`（模型再次发起工具调用）：

```jsonc
{
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Let me check the log." },
      { "type": "tool_use", "id": "toolu_02DEF", "name": "read", "input": { "path": "/tmp/b.log" } },
    ],
  },
  "stopReason": "tool_use",
  "usage": { "inputTokens": 412, "outputTokens": 57 },
}
```

`FakeProvider` 脚本（FIFO 弹出）：

```ts
new FakeProvider({
  responses: [
    chatResponse(
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'ls', input: { path: '.' } }] },
      'tool_use',
    ),
    chatResponse({ role: 'assistant', content: 'done' }, 'end_turn'),
  ],
})
```

## 4. 调用时序与异常语义

调用方为 `runtime`：`provider.invoke(req, signal?)` → 等待 → 拿到 `ChatResponse`。流式：`for await (const chunk of provider.stream(req, signal))`。

`IModelProvider` 的失败语义由抽象层定义，不在本模块额外约定：

- `AnthropicProvider.invoke`：把 `ChatRequest` 投影为 Anthropic messages API 请求；网络/鉴权/限流错误直接 reject（不吞错）。`signal.aborted` 触发中止并 reject。`tool_use` 块必须被解析为 `ToolUseBlock[]` 放进 `message.content`。
- `AnthropicProvider.stream`：以 `text_delta` / `tool_use` / `message_stop` chunk 顺序产出；流中错误向上抛至迭代方。
- `AnthropicProvider.countTokens`：优先调用远程 count-tokens endpoint，失败时回退本地估算；用于 memory/trim 决策。
- `FakeProvider.invoke`：**可 reject**。`responses` 队列为空且无 `handler` 时 reject，错误信息为 `"FakeProvider: no scripted response for call #<N>"`（测试断言 `/no scripted response/`，见 `test/provider/fake.test.ts:28-33`）。每次调用追加到 `this.calls`。
- 无“永不 reject”契约落在 provider 层 —— 只有 tool/skill 层有该契约。provider 抛错会冒泡到 runtime，由 runtime 决定是否重试。

## 5. 协议映射

### 5.1 Anthropic Messages API

`AnthropicProvider` 逐字段映射 `ChatRequest` ↔ Anthropic `/v1/messages`：

| 我们的 ChatRequest | Anthropic 请求 | 说明                                                                                                                                             |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`            | `model`        | 直传                                                                                                                                             |
| `messages`         | `messages`     | 直传；`Message.content` 字符串↔Anthropic `string`，块数组↔`content[]`                                                                            |
| `system`           | 顶层 `system`  | **不是** message 角色；`role:"system"` 不得出现在 `messages`（见 `interfaces.ts:73-83`）                                                         |
| `tools`            | `tools`        | 每个 `ToolDescriptor` 的 Zod `inputSchema` 先转 JSON Schema，再映射为 `{ name, description, input_schema }`（注意 snake_case）。无过滤，全部暴露 |
| `maxTokens`        | `max_tokens`   | snake_case                                                                                                                                       |
| `temperature`      | `temperature`  | 可选直传                                                                                                                                         |
| `toolChoice`       | `tool_choice`  | `"auto"`/`"any"`/`"none"` 直传；`{type:"tool",name}`↔`{type:"tool",name}`                                                                        |

响应方向 `Anthropic` → `ChatResponse`：

| Anthropic 响应字段                           | 我们的 ChatResponse                        | 说明                                                                              |
| -------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `content[]` 中 `type:"text"`                 | `message.content` 中的 `TextBlock`         | `text` 直传                                                                       |
| `content[]` 中 `type:"tool_use"`             | `message.content` 中的 `ToolUseBlock`      | `id`/`name`/`input` 直传；`input` 为 `unknown`，由 ToolExecutor 统一执行 Zod 校验 |
| `role`                                       | `message.role`（固定 `"assistant"`）       |                                                                                   |
| `stop_reason`                                | `stopReason`                               | `end_turn`/`tool_use`/`max_tokens`/`stop_sequence` 一一对应                       |
| `usage.input_tokens` / `usage.output_tokens` | `usage.inputTokens` / `usage.outputTokens` | camelCase 转换                                                                    |

`tool_result` 块（用户回传工具结果）不在 provider 响应中产出，而由 runtime 拼进下一轮 `messages`：`{ type:"tool_result", tool_use_id, content, is_error? }`，Anthropic 原样接受。

`stream` chunk 映射：Anthropic `content_block_delta` (text) → `{type:"text_delta"}`；`content_block_start` (tool_use) / 累积 `input_json_delta` 完成后 → `{type:"tool_use", block}`；`message_delta`+`message_stop` → `{type:"message_stop", stopReason, usage}`。

`countTokens` 优先调用 Anthropic `count_tokens` endpoint，失败时回退 chars/4 本地估算；兼容 endpoint 可关闭远程计数。

### 5.2 OpenAI Responses API

`OpenAIResponsesProvider` 使用 `store: false`，每次发送完整 canonical history。映射范围包括：

- `system` → `instructions`，messages → Responses input items。
- 普通本地工具 → function tools；只有 `customToolNames` 中的工具才使用 `{ type: "custom", name }`。
- DeepSeek `apply_patch` 的 `custom_tool_call.input` 是自由文本字符串，runtime 保持原值并以 `custom_tool_call_output` 回传结果。
- 普通 agent 请求只传入当前可用工具集，`tool_choice` 固定为 `"auto"`，由模型自行决定调用工具或直接返回消息；canonical `ChatRequest.toolChoice` 不改变该行为。
- reasoning、message、function call、custom tool call、web search 等 output 被翻译成 Roxy transcript items，下一轮由 adapter 转回 Responses input。
- semantic SSE → `text_delta` / `thinking_delta` / `thinking_block` / `tool_use` / `message_stop`。
- `completed` / `incomplete` / `failed` 终态及 input、cached、output、reasoning token usage。
- structured output 的 function calling、JSON mode 和 JSON Schema 三种策略。

DeepSeek Responses API 示例：

```ts
const provider = new OpenAIResponsesProvider({
  apiKey,
  model: 'deepseek-v4-flash',
  baseURL: 'https://api.deepseek.com',
  customToolNames: ['apply_patch'],
  additionalTools: [{ type: 'web_search' }],
})
```

DeepSeek Responses 路径通过 `customToolNames` 精确发送 `apply_patch`：

```json
{ "type": "custom", "name": "apply_patch", "description": "Use the apply_patch tool ..." }
```

DeepSeek 返回的 `custom_tool_call.input` 作为原始字符串进入 runtime，下一轮按 transcript 中的 `toolKind: "custom"` 还原为 `custom_tool_call` / `custom_tool_call_output`。

## 6. 验收标准

绑定契约测试（实现需通过同等断言）：

- **FakeProvider**（`test/provider/fake.test.ts`）：
  - `:9-26` `responses` 队列 FIFO 弹出，逐次 `invoke` 返回脚本响应；`calls.length` 记录全部调用。
  - `:28-33` 无脚本响应时 `invoke` reject，错误匹配 `/no scripted response/`。
  - `:35-45` 支持 `handler(req, callIndex)` 按请求计算响应。
  - `:47-53` `countTokens` 默认 ~4 chars/token：`"12345678"`（8 char）→ `2`。
  - `:55-69` `stream` 从脚本响应派生 chunk：首 chunk `{type:"text_delta",text:"hello"}`，末 chunk `{type:"message_stop"}`。
- **AnthropicProvider**（v1 无独立 contract test，需满足）：
  - 字段映射严格按上表 5：`maxTokens`→`max_tokens`、`system` 顶层、`tools` 中 `input_schema` snake_case。
  - 解析响应 `tool_use` 块入 `ToolUseBlock[]`，`stop_reason`↔`stopReason`，`usage` 字段名 camelCase。
  - `id === "anthropic"`，API key 由宿主解析后通过 `apiKey` 直接传入。

## 7. 边界用例 / 不做清单（v1 out of scope）

- 不内置 Gemini 等其他协议；用户可通过 `IModelProvider` 自行扩展。
- 不做自动重试 / 速率退避（由 runtime 或上层负责）。
- `system` 使用多段 canonical text blocks；各 Provider 决定如何映射到 wire protocol。
- `countTokens` 优先调 Anthropic `messages.countTokens` API（失败回退 chars/4 估算）；DeepSeek 经 `countTokensApi: false` 关闭 API 路径（其端点不支持）。
- **prompt caching 已接通**：`SystemBlock.cache_control` 透传上线；请求无显式断点时
  自动放置两个 `ephemeral` 断点（最后一个 system block + 最后一条消息的最后一个可缓存
  block）；`promptCaching: false`（DeepSeek 内部固定关闭）时剥离一切 `cache_control`。
- 不解析图片 / 文件等扩展块（仅 text + tool_use + tool_result + cache_control）。
- 不处理 `tool_choice` 之外的高阶路由（如 forced parallel tool use 配置）。
- `FakeProvider` 非生产 provider，不进生产链路。
