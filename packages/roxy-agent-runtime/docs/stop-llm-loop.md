读完源码后，Codex 的“任务停止”是两层判断：

## 1. 单次 Responses 请求什么时候停止接收

Codex 会持续消费 SSE/WebSocket 事件。

关键事件是：

```text
response.output_item.added
response.output_text.delta
response.output_item.done
response.completed
response.incomplete
response.failed
```

`delta` 事件只用于增量显示，不决定任务结束。

真正让本次模型请求正常结束的是：

```text
response.completed
```

解析位置：

[responses.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/sse/responses.rs:434)

Codex 只从 `response.completed` 中读取：

```rust
id
usage
end_turn
```

对应结构：

[responses.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/sse/responses.rs:114)

注意：Codex 没有读取或保存标准响应里的 `status`、`stop_reason`、`finish_reason` 等字段。也就是说，它不会自己判断“这是因为自然结束、长度结束还是其他 stop”。

收到 `response.completed` 后，底层 stream 发送：

```rust
ResponseEvent::Completed {
    response_id,
    token_usage,
    end_turn,
}
```

然后结束本次采样循环：

[client.rs](/Users/macos/Projects/codex/codex-rs/core/src/client.rs:2002)

如果 SSE/WS 没有收到 `response.completed` 就结束，Codex 会认为流异常：

```text
stream closed before response.completed
```

SSE 路径见：

[responses.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/sse/responses.rs:517)

WebSocket 路径见：

[responses_websocket.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/endpoint/responses_websocket.rs:708)

所以：

```text
response.completed = 正常完成本次模型请求
没有 response.completed = 流错误，不是正常完成
```

## 2. 整个 Codex turn 是否继续

收到 `response.completed` 后，Codex 会检查本次响应中是否产生了后续工作的理由。

### 模型产生 tool call

`response.output_item.done` 中如果是工具调用，Codex 会：

1. 记录工具调用；
2. 执行工具；
3. 设置 `needs_follow_up = true`。

代码：

[stream_events_utils.rs](/Users/macos/Projects/codex/codex-rs/core/src/stream_events_utils.rs:295)

以及：

[stream_events_utils.rs](/Users/macos/Projects/codex/codex-rs/core/src/stream_events_utils.rs:324)

因此工具调用后，即使当前 Response 已经 `completed`，外层 turn 仍会重新发起下一次 Responses 请求。

### `end_turn == false`

在 `response.completed` 中，如果后端传了：

```json
"end_turn": false
```

Codex 也会设置：

```rust
needs_follow_up = true;
```

代码：

[turn.rs](/Users/macos/Projects/codex/codex-rs/core/src/session/turn.rs:2341)

### 没有 tool call，且 `end_turn` 不是 `false`

外层就认为模型完成了任务：

```rust
if !needs_follow_up {
    ...
    break;
}
```

代码：

[turn.rs](/Users/macos/Projects/codex/codex-rs/core/src/session/turn.rs:425)

因此当前实际停止条件可以概括为：

```text
收到 response.completed
并且：
  没有 tool call
  且 end_turn != false
  且没有待处理的用户输入
  且 stop hook 没有要求继续
=> Codex 结束 turn
```

## `max_output_tokens` 到底在哪里起作用

当前源码中，Codex 主 Responses 请求甚至没有发送 `max_output_tokens`：

[common.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/common.rs:252)

所以 Codex 本身没有一个本地的：

```text
max_output_tokens = N
```

然后本地倒计时停止的逻辑。

如果上游确实因为 `max_output_tokens` 达到上限，按照 Responses API，通常会返回类似：

```json
{
  "type": "response.incomplete",
  "response": {
    "incomplete_details": {
      "reason": "max_output_tokens"
    }
  }
}
```

Codex 对所有 `response.incomplete` 的处理都一样：

```rust
Incomplete response returned, reason: max_output_tokens
```

然后把它转成流错误：

[responses.rs](/Users/macos/Projects/codex/codex-rs/codex-api/src/sse/responses.rs:423)

接着外层会把它作为可重试的 stream error 处理，而不是作为正常任务完成：

[turn.rs](/Users/macos/Projects/codex/codex-rs/core/src/session/turn.rs:1252)

也就是说：

```text
response.incomplete(reason=max_output_tokens)
=> Codex 认为本次响应失败/不完整
=> 可能重试整个 sampling request
=> 不是正常结束 turn
```

## 最重要的结论

Codex 当前不是根据 `max_output_tokens` 的数值自行决定停止，而是**信任上游最终事件**：

```text
response.completed => 正常完成
response.incomplete => 流错误/重试
response.failed => API 错误
流提前断开 => 流错误/重试
```

因此存在一个重要缺陷：

如果上游已经达到输出限制，但错误地返回：

```json
{
  "type": "response.completed",
  "response": {
    "status": "completed"
  }
}
```

或者返回一个合法的 `response.completed`，但没有正文、没有工具调用，那么 Codex 会把它当成成功结束。

它不会检查：

- 是否有可见文本；
- 是否有 tool call；
- 输出是否明显被截断；
- 是否真的完成了用户要求；
- 上游是否实际因为长度限制停止。

这就是“模型突然停止但 Codex 没报错”的主要机制。

完整流程是：

```text
Responses API
    |
    | response.output_text.delta
    | response.output_item.done
    v
Codex 聚合响应
    |
    | response.completed
    v
判断：
    |
    +-- 有 tool call --------> 执行工具 -> 继续下一次模型请求
    |
    +-- end_turn == false ---> 继续下一次模型请求
    |
    +-- 否则 ----------------> 结束 Codex turn
```

而 `max_output_tokens` 达限的理想路径应该是：

```text
response.incomplete(reason=max_output_tokens)
    -> Codex 报告“不完整”
    -> 续写或重试
```

但当前实现实际上是：

```text
response.incomplete(reason=max_output_tokens)
    -> 当成通用 Stream 错误
    -> 重试整个 sampling request
```

所以，如果你要判断一次停止是否真的是 `max_output_tokens`，最可靠的证据不是 UI，而是原始 Responses 事件：

- 有 `response.incomplete`
- `incomplete_details.reason == "max_output_tokens"`

才可以确认是 API 明确报告的输出上限。

如果看到的是：

- `response.completed`
- 没有 `response.incomplete`
- 没有 `response.failed`
- 没有 tool call
- 正文为空或明显没完成

那从 Codex 源码角度看，它会被判定为“正常完成”，更像是上游模型/后端的 premature stop，而不是 Codex 本地 `max_output_tokens` 判断。
