# 独立 Worker 进程设计

## 目标

`parallel_dispatch` 应该把每个委派任务放到独立的 `roxy-agent` 进程中执行，而不是在 orchestrator 进程内部再创建嵌套 agent。orchestrator 仍负责规划和最终汇总；worker 进程只执行一条委派任务，并通过 Node IPC channel 把带有 worker 作用域的事件回传给父进程。

本方案保留现有 agent 能力：worker 模式继续复用 `createChatAgent({ mode: 'simple', workerId })`。因为 `createChatAgent` 只有在 `mode === 'orchestrator'` 时才会挂载 `workerTools`，所以以 `mode: 'simple'` 创建出来的 worker 无法调用 `parallel_dispatch`，也就不会再创建下级 worker。

## 当前问题

现有 `parallel_dispatch` 会在同一个 Node.js 进程内创建多个 simple agent，并在工具函数内部消费每个 worker 的 stream。LangGraph/deepagents 可能把这些内部 stream 合并到父级 stream 中，因此 HTTP SSE 路由不得不依赖全局 `worker_start` 标记和 `chatRoutes.ts` 中的特殊过滤逻辑。这种做法让 stream 所属关系变得脆弱，也不具备请求级隔离。

把 worker 移到子进程后，每个 worker 都有独立的 LangGraph stream、独立的 MCP client 和清晰的进程生命周期。

## 目标架构

```text
Frontend stop button
  -> POST /api/conversations/:conversationId/stop
  -> abortRegistry aborts the orchestrator run
  -> parallel_dispatch receives config.signal abort
  -> parent sends cancel to all worker processes
  -> parent emits worker_stopped for each user-stopped worker
  -> workers abort their simple agents and close MCP clients
  -> parent waits for every worker to flush in-flight events and emit result
  -> parent emits orchestrator_stopped after all worker runners settle
  -> parent route emits interrupt/error as it does today
```

Worker stream 事件反向流动：

```text
worker agent.stream(...)
  -> handleWorkerStream(..., StreamState(taskId = workerId))
  -> worker process.send({ type: 'event', sse: StreamEvent })
  -> parent IPC message handler
  -> parent formats StreamEvent as browser-facing SSE and writes it to config.writer
  -> HTTP route writes browser-facing SSE
```

前端继续沿用现有 worker 事件契约：

- `worker_thinking`
- `worker_content`
- `worker_todo`
- 带 `taskId` 的 `tool_call` / `tool_result`
- `worker_result`
- `worker_stopped`
- `orchestrator_stopped`

## Worker 模式入口

Worker 模式只通过 worker 子命令启动：

```bash
roxy-agent worker --payload-file <abs-path>
```

Worker runner 必须使用 `process.argv[2] === "worker"` 进入该模式。`ROXY_MODE` 仍可服务其它启动模式的兼容路径，但不用于 worker 进程的模式选择或参数传递。

Mode 解析建议：

1. 如果 `process.argv[2]` 是 `agent`、`im`、`sandbox`、`worker` 之一，优先使用该子命令。
2. 非 worker 模式可继续读取 `env.ROXY_MODE` 作为兼容 fallback。
3. 默认 `agent`。

Worker 模式不能启动 HTTP server、IM adapter 或 sandbox runner。

Worker 参数始终从 `process.argv.slice(3)` 解析。

### 参数

Worker 仅接受单一参数：

| 参数 | 是否必填 | 说明 |
| --- | --- | --- |
| `--payload-file` | 是 | JSON 启动 payload 的绝对路径。 |

所有启动信息一律走 payload 文件，避免命令行参数过长以及跨平台 `ARG_MAX` 差异。如果未提供 `--payload-file`，worker 模式以 exit code `2` 拒绝启动。

### Payload 文件

Orchestrator 应把 payload 写入：

```text
${CHECKPOINT_DIR}/worker-payloads/<parentRunId>-<workerId>-<random>.json
```

父进程在子进程通过 IPC 发出 `ready` 后立即 unlink 该文件。如果 worker 在发送 `ready` 前退出，父进程在归并阶段 unlink。unlink 失败仅记录 warning，不影响 worker run 状态。此外 `parallel_dispatch` 在整批任务结束后还会按 `<parentRunId>-` 前缀做一次兜底清理，见 [整批兜底清理](#整批兜底清理)。

Payload 结构：

```json
{
  "protocolVersion": 1,
  "workerId": "profile-worker-0-a1b2c3d4-0",
  "parentRunId": "conv_123",
  "task": "Self-contained delegated prompt",
  "timeoutMs": 600000
}
```

校验规则：

- `protocolVersion` 必须是 `1`。
- `workerId`、`parentRunId` 和 `task` 必须是非空字符串。
- `timeoutMs` 必须是正整数。父进程在写 payload 前解析默认值，worker 不从环境变量读取超时参数。
- 未知字段应忽略，方便后续协议扩展。

`assignment.worker` 是模型选择的 worker 槽位名，例如 `profile-worker-0`；payload 里的 `workerId` 是单次 worker run 的唯一前端 `taskId`，必须包含本次 `parallel_dispatch` 的唯一后缀。这样同一轮 orchestrator 内第二次调用 `parallel_dispatch` 时，即使复用同一个 worker 槽位名，前端也会创建新的 worker 卡片，而不是把事件合并到第一次调用的同名卡片。

Worker 必须在 payload 文件**读取并 parse 成功**后才发送 `ready`，否则父进程会在 `ready` 之后立即 unlink 文件，导致 worker 自身后续读取失败。

## 环境变量与日志

Node `child_process.fork` 在未传 `options.env` 时会默认继承父进程的 `process.env`。worker 进程的模式和业务参数分别来自 `worker` 子命令和 payload 文件，因此 runner 不需要构造或覆盖 `env`。

`CHECKPOINT_DIR` 是父进程已注入的运行时根目录，不作为 worker 参数传递，但必须在 `fork` 前强校验。`packages/roxy-agent/src/index.ts` 会在 mode 分发之前先 `import './logger'`，logger 初始化时立即读取 `process.env.CHECKPOINT_DIR`。

```ts
const checkpointDir = process.env.CHECKPOINT_DIR
if (!checkpointDir) {
  throw new Error('CHECKPOINT_DIR must be set before starting worker process')
}
```

如果缺少 `CHECKPOINT_DIR`，不要启动 worker 子进程；否则 worker 会退回到 `process.cwd()` 写日志和状态文件，导致 payload、日志、MCP 状态与父进程不在同一 checkpoint 根目录下。

Agent 运行依赖的 `AGENT_SCRIPT_PATH`、`OPENAPI_SCRIPT_PATH`、`PLAYWRIGHT_SCRIPT_PATH`、`ROXY_API_KEY`、`ROXY_API_HOST`、`ROXY_SERVER_URL`、`ROXY_SERVER_HEADERS`、`DOWNLOADS_DIR`、`DESKTOP_DIR`、`SKILLS_DIR`、`ROXY_USER_ID`、`ROXY_WORKSPACE_ID`、`SYSTEM_LANGUAGE` 等变量由 fork 默认继承。runner 不应在子进程侧重新推导这些变量，也不应手写一个只包含少数字段的 `env` 对象。

当前 logger 对非 sandbox mode 使用 `logs/{mode}.log` 和 `logs/{mode}.2.log`。实现 worker mode 时必须避免多个并发 worker 共同写入并轮转同一个 `${CHECKPOINT_DIR}/logs/worker.log`。推荐改为：

```text
${CHECKPOINT_DIR}/logs/worker/<pid>.log
```

Logger 可以通过 `process.argv[2] === "worker"` 判断 worker mode；文件名使用 pid，因为 logger 初始化早于 payload 读取，不能依赖 payload 内的 `workerId`。Worker 在读取 payload 后应记录一行 worker id 与 pid 的绑定关系，父进程错误摘要也应同时包含 worker id、pid 和日志路径。stdout/stderr 保持关闭，避免多 worker 并发时出现管道背压。

## Worker Agent 运行时

Worker 模式应执行：

```ts
const { agent, destroy } = await createChatAgent({
  mode: 'simple',
  workerId,
})
```

Worker 不能传入 `conversationId`。这样 worker 执行保持无状态，避免 worker 自身触发 HITL/checkpoint 行为，并与当前进程内 worker 的行为一致。

Stream 配置继续使用 worker stream 转换路径：

```ts
const streamState = new StreamState()
streamState.setTaskId(workerId)

const stream = await agent.stream(
  { messages: [new HumanMessage({ content: task })] },
  {
    tags: [workerId],
    streamMode: ['messages', 'custom', 'tools'],
    signal: abortController.signal,
  },
)
```

对每个 raw chunk：

1. 调用 `handleWorkerStream(rawChunk, streamState)`，内部复用 `handleStreamEvents()` 生成结构化 `StreamEvent[]`。
2. 对每个返回的 `StreamEvent`，通过 IPC 发送一条 `event` 消息。
3. 用 `streamState.getLastChunkContent()` 保存最终 worker 文本。

协议层的 `sse` 字段使用结构化 `StreamEvent` JSON。`handleStreamEvents()` 是 raw chunk 到 `StreamEvent` 的唯一核心转换层；`handleStream()` 只在 HTTP SSE 路由中把这些事件格式化为字符串以保持旧调用方兼容；`handleWorkerStream()` 直接返回 `StreamEvent[]`，避免 worker 侧先生成 SSE 字符串再从 `data:` 行反解析。父进程收到 `StreamEvent` 后统一调用 `streamAdapter.formatSSE()` 输出 browser-facing SSE。

`destroy()` 必须放在 `finally` 中执行，保证 worker 总能关闭 deepagents runtime 和 Playwright MCP client。取消路径下 `destroy()` 自身要 race 一个 `WORKER_DESTROY_TIMEOUT_MS` 超时（默认 12000ms），避免 MCP/Chrome 关闭过慢导致 worker 进程一直挂着等父进程 SIGKILL。

## IPC 协议

父子进程通信使用 Node 的 IPC channel（`process.send` / `child.on('message')`）。协议消息通过 IPC 传输，诊断数据写入 `${CHECKPOINT_DIR}/logs/worker/` 下的 worker 日志文件。

IPC channel 由 Node 自动分帧，消息保持为 JSON 可序列化对象。应用层无需处理行缓冲或 partial chunk，但仍应避免发送超大单条消息；worker 只传递细粒度 `StreamEvent` 和终态结果。

`process.send` 在 channel 上保持调用顺序投递，单 worker 内事件顺序由此保证。不同 worker 之间按父进程实际收到 `message` 事件的顺序转发，不做全局序列化。

### Worker 到父进程

#### ready

参数解析完成、payload 文件读取成功、agent 启动前发送。

```json
{
  "type": "ready",
  "protocolVersion": 1,
  "workerId": "profile-worker-0",
  "pid": 12345,
  "startedAt": 1790000000000
}
```

#### event

每个由 worker stream 转换出的 `StreamEvent` 都发送一条 `event`。`sse` 字段使用结构化 JSON，形状与 `streamAdapter.formatSSE()` 接收的 `StreamEvent` 一致：

```json
{
  "type": "event",
  "protocolVersion": 1,
  "workerId": "profile-worker-0",
  "sse": {
    "type": "worker_content",
    "data": {
      "taskId": "profile-worker-0",
      "text": "partial worker output",
      "contentId": "content:abc123"
    },
    "timestamp": 1790000000001
  }
}
```

父进程收到后调用 `streamAdapter.formatSSE(message.sse)`，再写入 `config.writer`。

#### heartbeat

Worker 进程主动发送心跳，父进程只用心跳判断 worker 是否仍然可调度，避免把正常但长时间没有 `event` 的 MCP/Playwright 操作误判为假死。

```json
{
  "type": "heartbeat",
  "protocolVersion": 1,
  "workerId": "profile-worker-0",
  "pid": 12345,
  "timestamp": 1790000000001
}
```

默认心跳间隔为 `WORKER_HEARTBEAT_INTERVAL_MS = 15000`。父进程的过期阈值为 `WORKER_HEARTBEAT_TIMEOUT_MS = 60000`，等价于连续错过 4 次心跳后才判定 worker 不可响应。这个阈值足够覆盖短暂 GC、CPU 抖动和单次事件循环延迟，同时比业务级 `DEFAULT_WORKER_TIMEOUT_MS = 600000` 更早发现进程级卡死。

#### result

Worker run 到达终态时只发送一次。父进程负责用真实 `exitCode` 和 `signal` 补充最终面向前端的 `worker_result`。

```json
{
  "type": "result",
  "protocolVersion": 1,
  "workerId": "profile-worker-0",
  "status": "success",
  "result": "Final worker answer text",
  "error": null,
  "durationMs": 12345
}
```

`status` 取值：

- `success`：agent 正常完成。
- `failed`：agent 报错、参数处理失败、用户取消、业务超时或心跳过期。具体原因必须写入 `error`。

发送 `result` 时必须等待 `process.send` callback，避免消息尚未投递就关闭进程。callback 返回后，worker 继续执行 `destroy()` 的 graceful cleanup；cleanup 完成或 `WORKER_DESTROY_TIMEOUT_MS` 到期后，worker 主动 `process.disconnect()` 关闭 IPC，并设置 exit fallback，确保残留句柄不会让 worker 进程泄漏：

```ts
process.send({ type: 'result', ... }, async (err) => {
  process.exitCode = err || status === 'failed' ? 1 : 0
  await destroyWithTimeout()
  process.disconnect()
  setTimeout(() => process.exit(process.exitCode ?? 1), WORKER_EXIT_FALLBACK_MS).unref()
})
```

### 父进程到 Worker

#### cancel

```json
{
  "type": "cancel",
  "protocolVersion": 1,
  "reason": "user",
  "message": "User cancelled"
}
```

`reason` 取值：

- `user`：前端停止父级 conversation。
- `timeout`：父进程侧 worker 超时计时器触发。
- `parent_exit`：orchestrator 正在关闭。

收到 `cancel` 后，worker 模式应：

1. 调用 `abortController.abort(message)`。
2. 等待当前 stream loop 在 `AbortError` 后自然结束，期间已 yield 的 chunks 仍然通过 `event` 消息正常发送（保证前端不出现"半个字"）。
3. 发送 `status: failed` 的 `result`，并在 `error` 中写入 `Worker cancelled: ...` 或 `Worker timed out after ...ms` 等具体原因。
4. 在 `finally` 中执行 `destroy()`，由 `WORKER_DESTROY_TIMEOUT_MS` race。
5. cleanup 完成或超时后主动关闭 IPC 并结束进程。

父进程在发出 cancel/timeout 后已经把该 worker 标记为父进程失败。若 worker 随后又发送 `result`，这个 `result` 只作为“子进程已进入退出尾声”的生命周期信号，用于停止 timer 并等待进程退出；父进程不得把它写入 `protocolResult`，也不得把它返回给 orchestrator 汇总。

### 协议版本协商

Worker 启动时如果检测到 payload `protocolVersion !== 1`，立刻发送 `status: failed` 的 `result` 并退出。

父进程收到 `protocolVersion !== 1` 的任何消息时：

1. 记录协议不兼容错误，并附带 worker id、pid 和约定日志路径用于诊断。
2. 视为 incompatible，触发 `cancel({ reason: 'parent_exit' })` 流程。
3. 归并状态强制为 `failed`，不尝试做版本降级解析。

## 父进程 Runner

`parallel_dispatch` 应把进程内 worker 创建替换成子进程 runner。Agent 入口路径直接读取 `env.AGENT_SCRIPT_PATH`：

```ts
const agentScriptPath = process.env.AGENT_SCRIPT_PATH
if (!agentScriptPath) {
  throw new Error('AGENT_SCRIPT_PATH must be set by parent process')
}
```

Electron 主进程负责注入合法路径，runner 不做 fallback、不做存在性 / 可执行性校验。同时 runner 必须校验 `CHECKPOINT_DIR`，因为 logger 会在 worker mode 代码执行前读取该变量。

推荐 `fork` 参数：

```ts
const checkpointDir = process.env.CHECKPOINT_DIR
if (!checkpointDir) {
  throw new Error('CHECKPOINT_DIR must be set before starting worker process')
}

fork(agentScriptPath, ['worker', '--payload-file', payloadPath], {
  stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  execArgv: ['--experimental-strip-types'],
})
```

不传 `env`，让 fork 默认继承父进程环境。Worker 专属参数只通过子命令和 payload 文件进入子进程。

子进程 `stdio` 配置：

- stdin: `ignore`，worker 不读 stdin，避免 EPIPE。
- stdout/stderr: 默认 `ignore`。worker 的 `console.*` 写入自身日志文件，协议使用 IPC。
- 第 4 项 `ipc`: 协议主信道。

开发调试时可以临时把 stdout/stderr 改成 `pipe` 并镜像输出，但父进程必须持续消费这些 stream，避免 pipe buffer 填满后对子进程造成背压。该调试路径不应进入协议或结果归并逻辑。

`parallel_dispatch` 应对所有 assignments 调用 runner，并等待所有 runner promise settle。单个 worker 失败不能提前取消其他 worker。

### 时间常数

| 常量 | 默认值 | 说明 |
| --- | --- | --- |
| `WORKER_GRACEFUL_SHUTDOWN_MS` | 15000 | 父进程发出 cancel 后等待 worker 发送 result 的窗口。 |
| `WORKER_DESTROY_TIMEOUT_MS` | 12000 | worker 内部 `destroy()` 的 race timeout。比 graceful 略短，给 IPC drain 留余量。 |
| `WORKER_FORCE_KILL_MS` | 5000 | SIGTERM 后到 SIGKILL 的间隔。 |
| `WORKER_RESULT_EXIT_GRACE_MS` | 15000 | 父进程收到 worker `result` 后等待子进程完成 cleanup、关闭 IPC 并退出的窗口。 |
| `WORKER_EXIT_FALLBACK_MS` | 2000 | worker 关闭 IPC 后仍有残留句柄时，主动 `process.exit()` 的兜底延迟。 |
| `WORKER_HEARTBEAT_INTERVAL_MS` | 15000 | worker 主动发送 IPC 心跳的间隔。 |
| `WORKER_HEARTBEAT_TIMEOUT_MS` | 60000 | 父进程连续 4 次未收到 heartbeat 后视为 worker 不可响应。 |
| `DEFAULT_WORKER_TIMEOUT_MS` | 600000 | 父进程写 payload 时使用的默认单 worker 业务执行超时。 |

### Timeout 处理

1. 为每个 worker 启动独立 timeout timer（基于 payload `timeoutMs`）。
2. 超时后发送 `cancel({ reason: 'timeout' })`。
3. 进入 graceful 等待（`WORKER_GRACEFUL_SHUTDOWN_MS`）。
4. 如果之后收到 worker `result`，忽略其业务内容，只用它停止 watchdog/timer 并进入 result-exit grace。
5. 仍未收到 `result` 或进程未退出 → SIGTERM。
6. 再等 `WORKER_FORCE_KILL_MS` → SIGKILL。
7. 即使最终因 signal 退出，归并状态也报告 `failed`，`error` 写入 `Worker timed out after <timeoutMs>ms`。

### 取消处理

1. 监听 `config.signal`。
2. abort 后向所有活跃 worker 发送 `cancel({ reason: 'user' })`。
3. 对每个被用户停止的 worker 立即发送 `worker_stopped` SSE，`status` 固定为 `failed`，`error` 写入 `Worker cancelled: User cancelled`。这让前端在 graceful shutdown 期间先停止 worker 卡片转圈。
4. **保留 message handler 继续转发 cancel 之后到达的 `event`**：前端已经看到的 partial worker_content 如被强行截断会出现"半个字"，把 in-flight 事件发完是更自然的体验。归并时只看最终 status，不看 event 内容。
5. 进入 graceful 等待 `WORKER_GRACEFUL_SHUTDOWN_MS`。
6. 如果之后收到 worker `result`，忽略其业务内容，只用它停止 watchdog/timer 并进入 result-exit grace。
7. worker 自然 exit → 归并完成。
8. 超时未收到或进程未退出 → SIGTERM；再 `WORKER_FORCE_KILL_MS` 后 SIGKILL。
9. 等待所有 WorkerRunner promise settle 后，先清理整批 payload，再发送 `orchestrator_stopped` SSE。
10. `parallel_dispatch` 抛出 `User cancelled`，让外层 `/api/chat` 进入中断收口路径，不再把取消后的 worker markdown 当成成功工具结果返回给 orchestrator。

最坏场景：用户点击 stop 后，如果 worker 始终不响应，前端最长约 20s（15s graceful + 5s SIGTERM 等待）看到该 worker 归终态；如果 worker 在 graceful 末尾才发送 `result` 但 cleanup 又卡住，则还会进入 result-exit grace，最长约 35s（15s graceful + 15s result-exit grace + 5s SIGTERM 等待）后由父进程强制收口。

### Heartbeat 检测

每个 worker 主动每 15s 发送一次 `heartbeat`。父进程的 WorkerRunner 维护 `lastHeartbeatAt` 时间戳，`ready` 只用于初始化该时间戳，常规 `event` 不再作为 liveness 依据。这样即使 worker 正在等待一个长时间没有 stream 输出的 MCP/Playwright 调用，只要进程 event loop 仍然健康，心跳就会继续刷新。

一个独立的 `setInterval`（5s 粒度）做检查：

```ts
const idle = Date.now() - this.lastHeartbeatAt
if (idle > WORKER_HEARTBEAT_TIMEOUT_MS) this.handleHeartbeatTimeout(idle)
```

`handleHeartbeatTimeout()` 行为：

1. 标记 runner 为 `terminating`，避免重入。
2. 记录 `parentFailureError = "Worker heartbeat expired after <idle>ms (interval=15000ms, timeout=60000ms)"`。
3. 直接 `process.kill(child.pid, 'SIGKILL')`；`child.killed` 只表示是否已发过信号，不作为是否需要强杀的依据。
4. 等待 child `exit` 事件触发统一归并，并发送最终 `worker_result`。
5. 清理 heartbeat watchdog timer，防止 leak。

旧方案用“任意 IPC 消息间隔”判断 stale，容易误杀长时间没有 stream 输出的正常业务。新方案把 liveness 独立为 heartbeat：

```
正常跑:        ──heartbeat──heartbeat──event──heartbeat──result──exit
             ↑ heartbeat 独立刷新 lastHeartbeatAt

业务过长:      ──heartbeat──heartbeat─────(long MCP call)────heartbeat──
             ↑ 即使没有 event，进程健康时 heartbeat 仍持续

进程卡死:      ──heartbeat──heartbeat──(60s no heartbeat)
             ↑ heartbeat timeout 触发, SIGKILL, 归并 failed
```

## 结果归并

父进程 runner 应把进程状态、协议状态、heartbeat 检测归并成一个终态结果：

```ts
interface WorkerResult {
  worker: string
  status: 'success' | 'failed'
  result: string
  error?: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  durationMs: number
}
```

WorkerRunner promise 的 settle 边界是**进程终态归并完成**，不是收到 `result` 消息。正常路径下，runner 收到 worker 的协议 `result` 后立即停止业务 timeout 和 heartbeat watchdog；如果 `result.status === "success"`，父进程在协议层冻结该 worker 的成功语义。随后 runner 继续等待 child `exit`/`close`，拿到真实 `exitCode` 和 `signal`，再发送最终 `worker_result` SSE 并 resolve。异常路径下，runner 在 timeout、cancel、heartbeat timeout 或 child `error` 后完成必要的 SIGTERM/SIGKILL 流程，合成终态结果后再 resolve。

收到 `result` 后仍然等待进程退出，是为了保证 worker 已完成 `destroy()`、关闭 MCP/Playwright 子资源并断开 IPC。如果 worker 在 `WORKER_RESULT_EXIT_GRACE_MS` 内没有退出，父进程先 SIGTERM，再经过 `WORKER_FORCE_KILL_MS` 后 SIGKILL，防止进程泄漏。这个 post-result cleanup 失败只记录 warning；在没有父进程预先失败的前提下，不会把已经收到的成功 `result` 翻译成失败。

因此 `parallel_dispatch` 中的 `Promise.allSettled(runnerPromises)` 是整批 worker 进程的 barrier：它完成时，所有 worker 都已经成功退出、取消退出、报错退出，或被父进程强制终止并完成归并。

归并优先级（高到低）：

1. 如果父进程已经记录 timeout、cancel、protocol mismatch 或 heartbeat timeout，后续 worker `result` 一律忽略，报告 `failed` 并保留父进程错误。
2. 协议 `result.status === "success"` 且父进程没有预先失败 → 报告 `success`；即使 post-result cleanup 需要 SIGTERM/SIGKILL，也只作为资源回收 warning。
3. 协议 `result.status === "failed"` → 报告 `failed`，优先保留 worker result 中的 `error`。
4. 非零 exit、child `error` 或缺少协议 result → 报告 `failed`，error 中包含 exit code、signal、worker id、pid。
5. 历史状态值 `error`、`cancelled`、`timeout` 必须归一化为 `failed`。

如果 worker 在发送 `result` 前异常退出，父进程应合成 `failed` 结果，`error` 中包含 exit code、signal、worker id、pid 和约定日志路径。

子进程退出（或 heartbeat timeout 后被 kill）后，父进程应发送最终前端 SSE：

```json
{
  "type": "worker_result",
  "data": {
    "taskId": "profile-worker-0",
    "status": "failed",
    "exitCode": 1,
    "signal": null,
    "error": "Tool execution failed",
    "durationMs": 12345
  }
}
```

`parallel_dispatch` 返回给 orchestrator 的 markdown 也应包含同样的终态元数据，方便 orchestrator 基于清晰的 worker 结果做最终汇总。

用户手动取消时，父进程还会额外发送两个终止事件：

```json
{
  "type": "worker_stopped",
  "data": {
    "taskId": "profile-worker-0-a1b2c3d4-0",
    "status": "failed",
    "reason": "user",
    "error": "Worker cancelled: User cancelled"
  }
}
```

```json
{
  "type": "orchestrator_stopped",
  "data": {
    "status": "failed",
    "reason": "user",
    "message": "Orchestrator stopped: User cancelled"
  }
}
```

`worker_stopped` 是面向前端的即时状态事件，不替代最终 `worker_result`。`orchestrator_stopped` 必须在所有 WorkerRunner promise settle 且整批 payload 清理之后发送；如果取消发生时不在 `parallel_dispatch` 内，`/api/chat` 路由会在 abort catch 中发送同样的事件作为兜底。

## Payload 文件清理

采用双重保险策略。

### 单 worker 清理

- 收到 `ready` → 父进程 unlink 对应 payload-file。
- worker 在 `ready` 之前退出 → 父进程在归并阶段 unlink。
- unlink 失败仅 warn，不影响 run 状态。

### 整批兜底清理

`parallel_dispatch` 在 `await Promise.allSettled(runnerPromises)` 完成后、return 之前再扫一次。这里的 `runnerPromises` 必须是上文定义的 WorkerRunner promise，不能是仅代表“已启动子进程”或“已收到协议 result”的轻量 promise：

```ts
async function sweepBatchPayloads(parentRunId: string) {
  const dir = path.join(CHECKPOINT_DIR, 'worker-payloads')
  try {
    const files = await fs.readdir(dir)
    const orphans = files.filter(f => f.startsWith(`${parentRunId}-`))
    await Promise.allSettled(orphans.map(f => fs.unlink(path.join(dir, f))))
    if (orphans.length) logger.warn(`sweep: removed ${orphans.length} payload(s) for ${parentRunId}`)
  } catch (e) {
    logger.warn(`sweep failed: ${e}`)
  }
}
```

按 `parentRunId-` 前缀 scoped 清理，不会误删其它 run 的并发文件。

## HTTP SSE 路由调整

Worker 隔离后，`chatRoutes.ts` 只处理 orchestrator 外层 stream。`isWorkerStart()` 和 `parallel_dispatch` 特殊过滤分支应随进程内 worker 路径一起删除：

```ts
for await (const rawChunk of stream) {
  const result = handleStream(rawChunk, state)
  // write result to streamCallback as before
}
```

`/api/chat` 应在 `finally` 中的 `destroy()` 之后调用 `cleanupRun(conversationId)`，避免已完成 run 留下过期 abort controller。

前端取消 API 保持不变：

```text
POST /api/conversations/:conversationId/stop
```

该接口继续先取消 HITL gate，再调用 `abortRun`。

## 前端契约

前端改动保持最小：

- `WorkerStatus` 保持 `pending | success | failed`。
- 解析历史 SSE 时，把旧的 `worker_result.status === "error" | "cancelled" | "timeout"` 归一化为 `failed`。
- 从 `worker_result` 中存储 `exitCode`、`signal`、`error` 和 `durationMs`。
- 收到 `worker_stopped` 时，把对应 worker 卡片和其内部 pending tool 标记为 `failed`。
- 收到 `orchestrator_stopped` 时，停止本条 assistant 消息的 streaming 状态，并把所有仍处于 pending 的顶层工具调用、worker 卡片和 worker 内部工具调用标记为 `failed`。这覆盖用户取消时 `parallel_dispatch` 工具本身仍在等待多个 worker settle 的场景。
- Worker 卡片继续使用现有状态图标；当状态为 `failed` 时展示紧凑的错误或退出摘要。

顶层完成事件仍保留 `done`、`error`、`interrupt` 的兼容语义；`orchestrator_stopped` 是取消路径的额外终止信号，前端没有主 agent 状态展示时也必须消费它来关闭 loading 状态。

## 实现顺序

1. logger worker 分支：基于 `process.argv[2] === "worker"` 和 pid 写入 `${CHECKPOINT_DIR}/logs/worker/<pid>.log`，并禁止多 worker 共享 `logs/worker.log`。
2. 协议 helper：worker-side `send` 封装与 parent-side `WorkerRunner`（基于 `process.send` / `child.on('message')`）。
3. payload-file 加载与单一参数解析（仅 `--payload-file`），并校验 `CHECKPOINT_DIR` 和 payload `workerId`。
4. `runWorkerMode()`：`createChatAgent({ mode: 'simple' })` + `handleWorkerStream` + 协议封装 + `destroy()` race timeout。
5. `WorkerRunner`：fork、message 处理、heartbeat watchdog、graceful cancel、归并；默认不传 `env`，`stdio: ['ignore', 'ignore', 'ignore', 'ipc']`。
6. `parallel_dispatch` 替换为父进程 runner，加 `sweepBatchPayloads`。
7. 移除 `worker_start` 标记和 `chatRoutes.ts` 中的 stream 过滤逻辑。
8. 扩展 `streamAdapter`：保留字符串 SSE 方法，同时补充 `*Event()` 结构化事件构造方法，并扩展 `workerResult` 与前端 worker 状态元数据。
9. 静态验证：`pnpm -F roxy-agent run build` 和 `pnpm -F web type-check`。

整体集成和手动验证由用户自行执行。
