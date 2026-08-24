# observability

## 1. 模块职责

记录 agent 完整生命周期的有序轨迹事件流（trajectory），供调试、可视化与回放。

## 2. 对外暴露的接口

契约定义在 `src/core/interfaces.ts`：

- `TrajectoryPhase` — `model_thought` / `tool_selected` / `hitl_intercept` / `tool_executed` / `result_returned` / `memory_trimmed` / `error`。
- `TrajectoryEvent` `{ traceId, ts, phase, data }`。
- `ITrajectoryRecorder` — `start(input) → traceId`；`emit(event)`；`end(traceId)`；`getTrace(traceId) → TrajectoryEvent[]`。

实现文件：

- `trajectory.ts` → `InMemoryTrajectoryRecorder`（测试用）、`JsonlTrajectoryRecorder`（行缓冲写文件，供 `src/debug/replay.ts` 回放）、`TrajectoryRecorderOptions`。

## 3. 数据示例

### 3.1 一次工具 turn 的 TrajectoryEvent 序列

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

非工具 turn 可能附带 `memory_trimmed` / `error`。Agent tree 生命周期通过 `AgentManagerOptions.onEvent` 单独发布。

### 3.2 JsonlTrajectoryRecorder 写出的两行

```jsonl
{"traceId":"trace-1","ts":1719300000000,"phase":"model_thought","data":{"stopReason":"tool_use"}}
{"traceId":"trace-1","ts":1719300000001,"phase":"tool_selected","data":{"name":"ls","toolUseId":"tu_1"}}
```

## 4. 调用时序与异常语义

- 单 turn canonical 序列：`model_thought → tool_selected → hitl_intercept? → tool_executed → result_returned`。
- `start(input)` 创建新 trace 返回唯一 `traceId`；`emit(event)` 按调用顺序追加；`end(traceId)` 收尾；`getTrace(traceId)` 返回有序事件。
- `ts` 由 recorder 在 **emit 时注入**（`Date.now()`，epoch ms）；调用方传 `0` 时 recorder 仍打上非零时间戳。
- `getTrace(unknownId)` 返回 `[]`（不抛错）。
- `emit` 对未知 `traceId` 静默忽略。
- 每个 `AgentResponse` 内嵌完整 `trajectory[]`，便于断言。

## 5. 协议映射 / 关键约定

- 被 `runtime/trajectory_bridge.ts` 喂入：streamEvents → `TrajectoryEvent` → `recorder.emit`。
- 与 logging 互补：轨迹 = 生命周期事件，日志 = 通用运行信息。
- 宿主构造 `JsonlTrajectoryRecorder` 时决定落盘路径；runtime 只消费 `ITrajectoryRecorder`。

## 6. 验收标准

- `start` 每次返回唯一 `traceId`（`test/observability/recorder.contract.test.ts`）。
- `emit` **保持插入顺序**，`getTrace` 按序返回。
- **unknown id → `[]`**。
- **stampTs**：调用方传 `ts: 0` 时，recorder 打上非零 `ts`。
- 生产 `InMemoryTrajectoryRecorder` / `JsonlTrajectoryRecorder` 必须满足上述契约。

## 7. 边界用例 / 不做清单（out of scope）

- 桩 recorder 方法目前抛 `NotImplementedError`。
- 不做跨进程轨迹聚合 / 远程上报。
- `JsonlTrajectoryRecorder` 仅行缓冲追加写文件；回放由 `src/debug/replay.ts` 负责（非本模块）。
