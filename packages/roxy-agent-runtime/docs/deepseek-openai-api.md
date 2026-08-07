# 使用 Responses API

> [!WARNING]
> **支持的模型**
>
> Responses API 目前仅支持 `deepseek-v4-flash` 模型，暂不支持 `deepseek-v4-pro` 模型。我们将于 2026 年 8 月初增加对 `deepseek-v4-pro` 模型的支持。

为了满足大家对 Codex 的需求，我们的 API 新增了对 Responses API 格式的支持，其 base_url 为 [https://api.deepseek.com](https://api.deepseek.com)。

通过简单的配置，即可在 Codex 中使用 DeepSeek 模型。

## 将 DeepSeek 模型接入 Codex

请参考[接入 Codex](/zh-cn/quick_start/agent_integrations/codex)。

## 通过 Responses API 调用 DeepSeek 模型

```python
# Please install OpenAI SDK first: `pip3 install openai`
from openai import OpenAI

client = OpenAI(api_key="<your DeepSeek API Key>", base_url="https://api.deepseek.com")

response = client.responses.create(
    model="deepseek-v4-flash",
    instructions="You are a helpful assistant.",
    input="Hi, how are you?",
)

print(response.output_text)
```

## 流式输出

设置 `stream: true`，响应将以语义化的流式 SSE 事件序列返回。每个事件带有表示事件类型的 `event` 字段和递增的 `sequence_number`。流以 `response.completed` / `response.incomplete` / `response.failed` 事件结束，没有 `data: [DONE]` 消息。

```python
stream = client.responses.create(
    model="deepseek-v4-flash",
    instructions="You are a helpful assistant.",
    input="Hi, how are you?",
    stream=True,
)

for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="")
```

完整事件列表：

| 事件 | 说明 |
| --- | --- |
| `response.created` | 首个事件；响应已创建，状态为 `in_progress` |
| `response.in_progress` | 响应正在生成中 |
| `response.output_item.added` / `response.output_item.done` | 一个输出 item（`reasoning` / `message` / `function_call` / `custom_tool_call` / `web_search_call`）开始 / 完成 |
| `response.content_part.added` / `response.content_part.done` | 输出 item 中的一个内容块开始 / 完成 |
| `response.reasoning_text.delta` / `response.reasoning_text.done` | 思维链文本增量 / 完整思维链文本 |
| `response.output_text.delta` / `response.output_text.done` | 输出文本增量 / 完整输出文本 |
| `response.function_call_arguments.delta` / `response.function_call_arguments.done` | Function 调用参数增量 / 完整参数 |
| `response.custom_tool_call_input.delta` / `response.custom_tool_call_input.done` | Custom 工具调用（`apply_patch`）输入增量 / 完整输入 |
| `response.web_search_call.in_progress` / `response.web_search_call.searching` / `response.web_search_call.completed` | 服务端联网搜索工具调用的状态更新 |
| `response.completed` | 响应正常完成时的最后一个事件，携带包含 `usage` 的完整 `response` 对象 |
| `response.incomplete` | 响应被截断（如达到 `max_output_tokens`）时的最后一个事件，携带完整 `response` 对象 |
| `response.failed` | 响应失败时的最后一个事件，携带含 `error` 详情的完整 `response` 对象 |

## 兼容性明细

本小节罗列了 DeepSeek API 对 Responses API 的兼容性细节。Responses API 完整格式定义，请参考 [OpenAI 官方 API 手册](https://developers.openai.com/api/reference/resources/responses/methods/create)。

### 顶层请求参数

| 参数 | 支持情况 |
| --- | --- |
| `model` | 支持。目前仅支持 `deepseek-v4-flash`（暂不支持 `deepseek-v4-pro`），见[模型 & 价格](/zh-cn/quick_start/pricing) |
| `input` | 支持。字符串或输入 item 列表；`input` 与 `instructions` 至少传一个 |
| `instructions` | 支持。作为第一条 system 消息 |
| `stream` | 支持 |
| `temperature` | 支持（范围 [0.0, 2.0]；思考模式下不生效） |
| `top_p` | 支持（思考模式下不生效） |
| `max_output_tokens` | 支持 |
| `top_logprobs` | 支持（范围 [0, 20]） |
| `tools` | 部分支持。`function` / `web_search` 支持；其他类型忽略，见下方 Tools 表 |
| `tool_choice` | 支持。`none` / `auto` / `required` / 指定某个工具（`{"type": "function", "name": ...}` 或 `{"type": "web_search"}` / `{"type": "web_search_2025_08_26"}`） |
| `reasoning` | 部分支持。`effort` 支持；`summary` 可传入但不生成摘要 |
| `text` | 部分支持。`format` 完整支持；`verbosity` 可传入但不生效 |
| `user` | 支持。参考[限速与用户隔离](/zh-cn/quick_start/rate_limit) |
| `parallel_tool_calls` | 忽略（并行工具调用始终开启） |
| `max_tool_calls` | 忽略 |
| `previous_response_id` | 不支持（无状态 API） |
| `conversation` | 不支持（无状态 API） |
| `store` | 不支持。响应中恒为 `store: false` |
| `background` | 不支持 |
| `metadata` | 不支持 |
| `include` | 不支持 |
| `prompt` | 不支持 |
| `truncation` | 不支持。输入超出上下文窗口时返回 `400` 错误 |
| `service_tier` | 不支持 |
| `safety_identifier` | 不支持 |
| `prompt_cache_key` / `prompt_cache_retention` | 不支持。上下文缓存自动管理，见[上下文硬盘缓存](/zh-cn/guides/kv_cache) |
| `context_management` | 不支持 |
| `stream_options` | 不支持 |

不支持的参数会被**静默忽略**、不会报错，因此现有的 Responses API 客户端无需修改即可接入。

### 输入 Items

| 类型 | 支持情况 |
| --- | --- |
| `message` | 支持。角色支持 `user` / `assistant` / `system` / `developer`（`developer` 视同 `system`）；content 支持字符串和 `input_text` / `output_text` 内容块。不支持图片、文件输入（`input_image` 内容块不会报错，但会被替换为占位文本） |
| `function_call` | 支持。归并到相邻 assistant 消息 |
| `function_call_output` | 支持 |
| `reasoning` | 支持。明文 `content` 归并到相邻 assistant 消息；`summary`、`encrypted_content` 不支持 |
| `web_search_call` | 支持。原样回传即可，服务端自动恢复搜索结果 |
| 其他类型 | 忽略 |

### Tools

| 类型 | 支持情况 |
| --- | --- |
| `function` | 支持 |
| `web_search` / `web_search_2025_08_26` | 支持，服务端执行。`search_context_size`、`user_location` 忽略 |
| `custom` | 仅支持 `{"type": "custom", "name": "apply_patch"}`（用于 Codex 兼容）；其他名称返回 `400` 错误 |
| `file_search` / `code_interpreter` / `computer_use` / `mcp` 等其他内置工具 | 忽略 |

### 响应字段

响应对象与 OpenAI Responses API 的 `response` 结构兼容。依赖未支持能力的字段恒为固定值（如 `store: false`、`previous_response_id: null`、`parallel_tool_calls: true`）。

Token 用量在 `usage` 中返回：

- `input_tokens`：输入 token 数，其中 `input_tokens_details.cached_tokens` 为命中[上下文缓存](/zh-cn/guides/kv_cache)的 token 数
- `output_tokens`：输出 token 数，其中 `output_tokens_details.reasoning_tokens` 为思维链 token 数
