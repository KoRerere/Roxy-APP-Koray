# Stream 多 Worker 模式问题定位

## 问题一：Worker 内层 stream 透传到最外层 stream

### 现象
当主 agent 调用 `parallel_dispatch` 时，worker 内部也是一个 agent，内部也在处理 stream。这些**内层 worker 的 stream 事件会出现在最外层的 `for await (const rawChunk of stream)` 里**，导致外层循环收到混在一起的事件（主 agent + 各 worker 的 messages/tools）。

### 根因分析

1. **主 agent 与 worker 共用同一条 stream 管道**  
   - 主 agent 使用 `createDeepAgent`（deepagents + LangGraph），`agent.stream(input, config)` 返回的 `stream` 来自图执行。  
   - 当图中执行到「调用工具」节点时，会执行 `parallel_dispatch`。  
   - 在工具内部又调用了 `agent.stream(state, {...})`（worker agent）。  
   - 在 LangGraph/deepagents 的实现里，**子 runnable（包括在 tool 里触发的 agent.stream）的流事件可能会被合并到父图的 stream 中**，所以外层消费者会同时收到：主 agent 的 messages/tools 和 worker 的 messages/tools。

2. **当前应对方式**  
   - 用全局 `worker_start` 在工具入口置为 `true`，外层循环里用 `if (isWorkerStart() && namespace !== 'custom') continue` 过滤掉「非 custom」的外层事件，从而在「worker 执行期间」只保留 custom（例如你们发的 worker 相关 custom 事件），避免把 worker 的 messages/tools 当主 agent 的再处理一遍。  
   - 这能缓解「透传」带来的错乱，但**没有从源头切断**内层 stream 合并到外层，所以会出现「worker 的 stream 透传到最外层」的奇葩情况。

### 结论
- **透传原因**：框架（deepagents/LangGraph）在 tool 执行期间，把内层 `agent.stream()` 产生的事件合并进了主图的 stream，所以外层 `for await` 会收到 worker 的 stream。  
- **可选方向**：  
  - 继续用 `worker_start` + 只保留 `custom` 的过滤（当前做法）；  
  - 或改用 worker 内 `agent.invoke()` 而不是 `agent.stream()`，避免内层产生 stream，从源头避免合并（会失去 worker 内流式）；  
  - 或依赖框架是否支持「不合并 tool 内子 stream」的配置（若有）。

---

## 问题二：parallel_dispatch 的 tool start 丢失，只有 end，agent 认为返回空

### 现象
- 调用 `parallel_dispatch` 时，**tool 的 start 事件丢失，只有 end**。  
- Agent 总是认为 `parallel_dispatch` 返回的是空，然后又重新开始处理任务。

### 根因分析

1. **`worker_start` 置 true 的时机**  
   - 在 `parallel_dispatch` 工具里，**第一行**就是 `worker_start = true`（在 `Promise.all` 之前同步执行）。  
   - 所以一旦工具被调用，`worker_start` 立刻为 `true`。

2. **外层循环的过滤逻辑**  
   - 当前逻辑：`if (isWorkerStart() && namespace !== 'custom') continue`  
   - 即：只要 `worker_start === true`，**所有非 custom 的 chunk 都会被 skip**，包括主 agent 自己的 **tools** 命名空间事件（`on_tool_start` / `on_tool_end`）。

3. **事件顺序与「谁先被 skip」**  
   - 主图 stream 里事件的顺序可能是：  
     - 先发出 `parallel_dispatch` 的 `on_tool_start`，再执行 tool 体；  
     - 或先执行 tool 体（`worker_start = true`），内层 worker stream 开始往主 stream 合并，再发出 `on_tool_start`。  
   - 若是后者，则当外层循环收到 `on_tool_start` 时，**已经处于 `worker_start === true`**，于是 `on_tool_start` 被 **continue 掉**，没有进 `handleStream`，也就没有产生前端的 toolCall、也没有更新 `state.callTool()`。  
   - 随后收到 `on_tool_end` 时，同样因为 `worker_start` 仍为 `true`，**也被 continue 掉**，没有进 `handleStream`，没有 `toolResult`，也没有 `state.callToolEnd()`。

4. **为何 agent 认为返回空 / 会重试**  
   - 若框架侧是根据「stream 里的 tool 事件」来更新状态或判断工具是否被正确调用，那么 **start 被 skip 会导致「没有记录到这次 tool 调用」**。  
   - 只看到 end 或 end 也被 skip，会导致状态不一致（例如缺少 `callToolId`、或 tool 结果未被正确写回），agent 就会认为这次工具调用不完整或返回空，从而重试。

### 结论
- **start 丢失的直接原因**：在 `worker_start === true` 期间，外层把 **所有** 非 custom（包括 `tools` 命名空间）都 skip 了，所以 **orchestrator 自己的 `parallel_dispatch` 的 `on_tool_start` / `on_tool_end` 也被 skip**，导致 start（以及可能 end）丢失。  
- **修复思路**：在「worker 执行期间」过滤时，**不要 skip 主 agent 的 `parallel_dispatch` 的 tools 事件**，即：当 `namespace === 'tools'` 且 `chunk.name === 'parallel_dispatch'` 时，不要 continue，照常进 `handleStream`，这样 start/end 都会保留，agent 状态和前端都能收到完整的 toolCall/toolResult。

---

## 额外问题：config.writer 未传入，worker 内 stream 无法主动写出

- 在 `chatRoutes` 里，只传了 `configurable`、`streamMode`、`signal`、`callbacks`，**没有传 `writer`**。  
- 工具里通过 `config.writer?.(...)` 写 worker 的 content/result，在未传 `writer` 时全部不会生效。  
- 若希望 worker 内的事件**只**通过「工具内主动写」而不是「依赖外层 stream 合并」，应在构造 stream 时把 `config.writer` 设为 `streamCallback`（或等价写出口），这样工具内 `config.writer` 才有用。

---

## 修复项汇总

1. **不跳过 parallel_dispatch 的 tools 事件**  
   - 在 `chatRoutes` 的 `for await` 里，当 `isWorkerStart() && namespace !== 'custom'` 时，**若** `namespace === 'tools' && chunk?.name === 'parallel_dispatch'`，则不要 continue，照常处理，保证 start/end 都进 `handleStream`。

2. **（可选）传入 config.writer**  
   - 在 `chatRoutes` 的 `config` 中增加 `writer: streamCallback`，这样 `parallel_dispatch` 工具内的 `config.writer?.(...)` 会真正把 worker 的 content/result 写到前端，不依赖「内层 stream 被合并到外层」这一行为。
