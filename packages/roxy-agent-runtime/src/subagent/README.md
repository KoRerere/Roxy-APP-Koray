# subagent

## 1. 模块职责

把一个任务委托给若干子 agent 执行——支持顺序流水线与并行扇出后聚合，每个子 agent 拥有独立记忆与线程。

## 2. 对外暴露的接口

契约定义在 `src/core/interfaces.ts`：

- `ISubAgentManager` — `delegate(task, mode, count?) → Promise<AgentResponse[]>`。
- `SubAgentMode` `"sequential" | "parallel"`。
- `Agent` — `delegate(...)` 顶层入口（转发到 manager）。
- `AgentResponse` `{ messages, trajectory }`。

实现文件：

- `manager.ts` → 子 agent 编排（sequential / parallel）。
- `graphs.ts` → 两种执行图的构造（当前仍是桩）。

## 3. 数据示例

### 3.1 sequential（流水线）

`delegate("research then summarize", "sequential", 3)`：

```
task → subagent[0] → output[0]
output[0] 作为 user msg → subagent[1] → output[1]
output[1] 作为 user msg → subagent[2] → output[2]
返回 [output[0], output[1], output[2]]
```

每个 `AgentResponse.messages` 为该子 agent 本次调用产生的消息（不含输入）。

### 3.2 parallel（扇出 + 聚合）

`delegate("批判性评审方案", "parallel", 3)`：

```
task ─┬─ subagent[0] → output[0]
      ├─ subagent[1] → output[1]
      └─ subagent[2] → output[2]
join(output[0..2]) → 聚合结果
返回 [output[0], output[1], output[2]]
```

### 3.3 AgentResponse 片段

```json
{
  "messages": [{ "role": "assistant", "content": "子 agent 0 的结论" }],
  "trajectory": [{ "traceId": "sub-0", "ts": 1719300000000, "phase": "model_thought", "data": {} }]
}
```

## 4. 调用时序与异常语义

- **sequential**：N 号子 agent 的输出作为 N+1 号子 agent 的 user 消息；任一环失败则链路中止。
- **parallel**：N 个子 agent 同时扇出执行，全部完成后 join 聚合（聚合策略由 manager 决定）。
- **每个子 agent 拥有独立的 `IMemoryProvider` 与独立的 `thread_id`**——互不污染历史。
- 子 agent 的 trajectory 各自独立（`AgentResponse.trajectory` 为 per-call，非跨调用累积）。

## 5. 协议映射 / 关键约定

- 委托是 runtime 之上的编排能力；每个子 agent 内部仍是一条标准消息循环（model→hitl→tools）。
- canonical phase：委托触发 `subagent_delegated`（见 observability）。
- 顶层 `Agent.delegate` 转发到 `ISubAgentManager.delegate`，签名一致。

## 6. 验收标准

- sequential：子 agent 按顺序执行，N 的输出成为 N+1 的输入，返回数组长度等于 `count`。
- parallel：子 agent 并发执行，结果按 subagent 顺序聚合返回。
- 每个子 agent 拥有独立 memory 与 thread_id，历史互不可见。
- 返回值为 `AgentResponse[]`，trajectory 为各自 per-call 事件。

## 7. 边界用例 / 不做清单（out of scope）

- 隔离粒度仅为 **per-thread_id**（独立记忆/轨迹），**非进程级隔离**。
- 不做子 agent 之间的实时通信 / 共享黑板（v1 各自独立）。
- 不做自动 `count` 推断（未传 `count` 时由 manager 默认策略决定）。
