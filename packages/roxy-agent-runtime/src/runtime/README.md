# runtime

## 1. 模块职责

用自研状态机驱动 Anthropic 消息循环——编排 model→hitl→tools 节点、条件边、流式事件转轨迹，并通过 rollout replay 实现跨进程恢复。

## 2. 对外暴露的接口

契约定义在 `src/core/interfaces.ts`：

- `Agent` — `id` / `sessionId`；`invoke(input)`；`stream(input)`；`structured(schema).invoke(input)`；`delegate(task, options)`；`dispose()`。
- `AgentResponse` `{ messages, trajectory }`；`AgentStreamEvent`（`text` / `thinking` / `tool_call` / `hitl_pending` / `tool_result` /
  `done`）。`text`、`thinking`、`tool_call` 携带本次 stream 内从 0 开始的 `callIndex`，宿主用它区分工具循环中的多次模型调用。
- 依赖契约 `AgentGraphDeps` `{ provider, tools, memory, hitl, recorder, logger }`（见 `graph.ts`）。

实现文件：

- `runtime.ts` → `AgentRuntime.create(definition)`，唯一公共组合入口；组装宿主注入的对象图、恢复 session、合并 plugins，并提供 `invoke` / `stream` / `structured`。
- `graph.ts` → `buildAgentGraph(deps)`（内部对象装配句柄）。
- `agent.ts` → 内部 `AgentImpl`，持有实际消息循环，不从 package root 导出。
- `trajectory_bridge.ts` → `TrajectoryBridge`（streamEvents → `TrajectoryEvent`）。

## 3. 数据示例

### 3.1 一次工具 turn 的 TrajectoryEvent 生命周期序列

```json
[
  { "traceId": "trace-1", "ts": 1719300000000, "phase": "model_thought", "data": { "stopReason": "tool_use" } },
  {
    "traceId": "trace-1",
    "ts": 1719300000001,
    "phase": "tool_selected",
    "data": { "name": "ls", "toolUseId": "tu_1", "input": {} }
  },
  {
    "traceId": "trace-1",
    "ts": 1719300000002,
    "phase": "hitl_intercept",
    "data": { "toolName": "ls", "decision": "approve" }
  },
  {
    "traceId": "trace-1",
    "ts": 1719300000003,
    "phase": "tool_executed",
    "data": { "name": "ls", "toolUseId": "tu_1" }
  },
  {
    "traceId": "trace-1",
    "ts": 1719300000004,
    "phase": "result_returned",
    "data": { "toolUseId": "tu_1", "isError": false }
  }
]
```

### 3.2 AgentResponse

```json
{
  "messages": [
    { "role": "assistant", "content": [{ "type": "tool_use", "id": "tu_1", "name": "ls", "input": {} }] },
    { "role": "tool", "content": [{ "type": "tool_result", "tool_use_id": "tu_1", "content": "file.txt" }] }
  ],
  "trajectory": []
}
```

`messages` 为本次 `invoke()` 产生的 assistant turn + tool result（oldest-first），**不包含输入**；`trajectory` 为**本次调用**事件，非跨调用累积。

## 4. 调用时序与异常语义

- 节点顺序：`model`（调用 provider）→ `hitl`（拦截）→ `tools`（执行）。
- 条件边：`stopReason === "end_turn" | "max_tokens"` → 结束；`stopReason === "tool_use"` → 回到 model 循环。
- `streamEvents()` 经 `TrajectoryBridge` 转为 `TrajectoryEvent` 喂入 `ITrajectoryRecorder`。
- `AgentResponse.trajectory` 是 **per-call**（每次 invoke 独立 trace），**非累积**。
- `AgentResponse.messages` **排除输入**消息。
- `role: "system"` 永不进入 `ChatRequest.messages`，由 `ChatRequest.system` 承载。
- `AgentRuntime.create` 不读取 env/JSON/YAML，不选择 provider，不扫描 skills/MCP，不注册默认工具，也不决定存储路径。

## 5. 协议映射 / 关键约定

agent state ↔ Anthropic 消息循环：

```
model 节点 → provider.invoke(req)
  返回 stopReason: tool_use + ToolUseBlock[]
  → assistant 消息(含 tool_use) 追加进 messages
tools 节点 → executor.execute(name, input, ctx, toolUseId)
  → tool_result 消息(role: tool) 追加进 messages
  → 回到 model 节点
直到 stopReason: end_turn / max_tokens
```

canonical phase 序列：`model_thought → tool_selected → hitl_intercept? → tool_executed → result_returned`（见 observability）。

## 6. 验收标准

- `tool_use` 触发 tools 节点并循环；`end_turn` / `max_tokens` 终止。
- streamEvents 经 `TrajectoryBridge` 产出有序 `TrajectoryEvent`，phase 序列符合契约。
- `AgentResponse.messages` 不含输入消息；`trajectory` 为本次调用事件。
- `AgentRuntime.invoke` / `stream` / `structured` / `delegate` 满足公开 `Agent` 契约。
- `structured(schema).invoke(input)` 先执行完整 Agent loop，再用同一 provider 对更新后的 session history 做一次 schema 提取；提取结果不写回 memory。

## 7. 边界用例 / 不做清单（out of scope）

- 不在本模块实现 memory / hitl / tools 业务逻辑——仅编排，依赖注入。
- `stop_sequence` 等其他停止原因按非循环处理（结束）。
- 桩实现目前抛 `NotImplementedError`；本文件为实现 runtime 后的对账基准。
