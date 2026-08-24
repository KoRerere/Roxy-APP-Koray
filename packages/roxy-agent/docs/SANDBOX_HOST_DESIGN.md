# Sandbox Host 常驻进程设计

## 1. 文档状态

- 状态：Chromium/Firefox 常驻 Host 主链路已实现
- 适用包：`packages/roxy-agent`
- 目标模式：`ROXY_MODE=sandbox`
- 最后更新：2026-08-18

当前实现范围：

- 已实现常驻 Host、版本化 IPC、generation、heartbeat、并发槽位、idle/max-runs/RSS 回收和 Host 故障归并。
- 已实现 run-scoped VM、虚拟 process/event/stdout/stderr、timer registry、Chromium/Firefox asset roots 与单连接清理。
- 已实现 Host -> Agent LLM RPC，模型凭据不下发到 Host。
- Firefox 通过与 Chromium 相同的 per-run Playwright facade 启用：`firefox.connect()` 返回的 browser 会被当前 run 记录，并在 run 结束时只关闭当前 run 拥有的 browser。
- `permissions` 已保留在协议、sidecar 解析与 fs facade 扩展点中；绝对路径 allowlist、realpath 与 symlink 强制策略按当前决策暂未实现。

本文定义 Roxy Agent 脚本 sandbox 从“每次运行创建一个子进程”迁移到“一个常驻 Sandbox Host 子进程内直接运行多个隔离 VM session”的目标架构、协议、生命周期、隔离边界、迁移步骤和验收标准。

本设计保持 agent、worker、sandbox 三种模式打包在同一个 bundle。bundle 拆分不在本文范围内。

## 2. 背景

### 2.1 迁移前执行链路

迁移前每次调用 `startSandboxScriptRun()` 都执行以下流程：

```text
Agent process
  -> sandboxService 解析脚本、权限、浏览器和输出目录
  -> child_process.fork(AGENT_SCRIPT_PATH, [scriptPath])
  -> 新进程通过 ROXY_MODE=sandbox 进入 runSandboxMode()
  -> 新进程创建 vm.Context / vm.SourceTextModule
  -> 调用脚本 main(options)
  -> process.send() 上报日志、返回值和产物
  -> sandbox 子进程退出
```

隔离核心分为两层：

1. 子进程负责进程生命周期、环境变量、cwd、退出和故障隔离。
2. `node:vm` 负责模块白名单、注入全局对象和脚本 API。

### 2.2 迁移前成本

每次运行都会重复支付：

- 创建完整 Node.js 进程。
- 初始化同一 agent bundle 和顶层模块。
- 初始化 logger、sandbox API 模块；存储迁移只由主 agent 入口负责。
- 建立和销毁 IPC channel、stdout、stderr。
- 为短脚本重复创建 V8 isolate 和 Node runtime。

脚本任务支持多窗口并发，默认并发为 `os.cpus().length + 2`。并发运行时，每个执行单元都会创建独立 sandbox 子进程，进程数量和内存随并发数线性增长。

### 2.3 目标

本设计的目标是：

- 一个 agent 实例最多维护一个常驻 Sandbox Host 子进程。
- Sandbox Host 直接创建 VM session，不创建 worker thread。
- 多个脚本可以在同一 Sandbox Host 的事件循环中异步并发。
- agent 对 Sandbox Host 保持进程级故障隔离和最终强杀能力。
- bundle 只在 Sandbox Host 启动时加载一次。
- `startSandboxScriptRun()` 的调用方契约和现有任务/会话结果语义保持稳定。
- 每个 run 的参数、日志、文件权限、浏览器连接、timer、产物和清理状态相互隔离。
- Sandbox Host 可在空闲、内存超限、运行次数超限或健康检查失败时回收并重启。

### 2.4 非目标

本文不包含：

- 拆分 agent、worker、sandbox bundle。
- 把 sandbox VM 放进 agent 主进程。
- 使用 `worker_threads` 或第三方 isolate runtime。
- 改变脚本入口 `main(options): Promise<string | void>`。
- 改变前端、Task Monitor、conversation event 或任务数据库协议。
- 为 sandbox 提供 CPU 并行执行能力。

## 3. 架构决策

### 3.1 目标拓扑

```text
Electron utility process
  -> Agent process (ROXY_MODE=agent)
       -> SandboxHostManager
            -> one long-lived child process (ROXY_MODE=sandbox)
                 -> SandboxRunSession A -> vm.Context A
                 -> SandboxRunSession B -> vm.Context B
                 -> SandboxRunSession C -> vm.Context C
```

Agent 与 Sandbox Host 使用 Node child-process IPC。Sandbox Host 内的所有 VM 共享一个 Node.js 事件循环和一个进程地址空间，但每个 run 使用独立的 `vm.Context`、模块缓存、虚拟 process、API 实例和清理注册表。

### 3.2 为什么保留独立 Sandbox Host 进程

不在 agent 主进程直接运行 VM，原因如下：

- 同步死循环会阻塞 agent HTTP、WebSocket、任务调度、IM 和所有会话。
- VM 没有独立于宿主进程的硬内存上限。
- VM 不是安全边界，尤其是宿主向 VM 注入 Playwright、Buffer、fs 等对象后。
- sandbox 脚本或原生依赖崩溃不应导致 agent 服务整体退出。
- agent 必须能从外部杀死一个不再处理事件的 sandbox 事件循环。

常驻 Sandbox Host 仍然提供进程级 blast radius：同步卡死、native crash 或不可恢复资源泄漏最多导致当前 Sandbox Host 和其中的活跃 run 失败，agent 可以检测、归并并重启 Host。

### 3.3 为什么不使用 worker thread

本方案不使用 worker thread，主要原因是资源模型：

- 每个 Worker 仍然创建独立 V8 isolate 和 heap。
- 每个 Worker 会重新加载 sandbox 依赖和模块实例。
- 浏览器自动化脚本主要等待网络和浏览器 I/O，不依赖 CPU 并行。
- 直接 VM session 的创建和销毁成本更低。

代价是多个 VM 共享事件循环。同步阻塞不能只终止单个 VM；最终恢复动作是由 agent 杀死整个 Sandbox Host，所有同 Host 活跃 run 一起结束。

### 3.4 关键接受项

选择常驻进程直接运行多 VM，意味着明确接受以下约束：

1. 正常异步任务可以并发，但不提供 CPU 并行。
2. 一个同步阻塞脚本可能影响同 Host 的其他 run。
3. 单个 run 无法在事件循环完全阻塞时被单独强杀。
4. Node permission flags 是进程级配置，不能作为动态、按 run 变化的唯一文件权限边界。
5. 每个 run 的隔离必须由 session-scoped capability、路径校验和资源注册表实现。
6. Host 不应持有完成脚本执行不需要的用户凭据和 agent 内部状态。

## 4. 组件职责

### 4.1 SandboxHostManager（Agent 进程）

已实现 `src/services/sandboxHostManager.ts`，作为 agent 进程内唯一的 Host 生命周期管理器。

职责：

- 懒启动 Sandbox Host。
- 等待 `host.ready` 后才接受 run。
- 维护 Host generation、pid、启动时间和健康状态。
- 维护 `runId -> PendingRun`。
- 管理全局并发 semaphore 和等待队列。
- 转发 `run.start`、`run.abort`、`host.shutdown`。
- 接收日志、产物、结果、heartbeat 和 fatal 消息。
- 检测 heartbeat 超时、IPC disconnect、error 和异常退出。
- Host 丢失时只归并属于当前 generation 的 pending run。
- 在空闲、RSS 超限或运行次数达到阈值时回收 Host。
- 保证同一时间只有一个启动或关闭流程。

Host manager 不负责：

- 解析脚本业务参数。
- 打开浏览器。
- 收集和上传最终产物。
- 发布 Task Monitor 事件。

这些职责继续保留在 `sandboxService.ts` 及其现有调用链中。

### 4.2 sandboxService（Agent 进程）

`src/services/sandboxService.ts` 继续作为业务边界，保留以下公开 API：

```ts
startSandboxScriptRun(options): Promise<StartedSandboxScriptRun>
getOccupiedSandboxDirIds(): string[]
openBrowserForDirId(dirId): Promise<BrowserConnection>
getOpenedCdpForDirId(dirId): Promise<BrowserConnection | null>
```

内部流程调整为：

1. 校验远程脚本 URL、权限文件和参数。
2. 向 `SandboxHostManager` 申请执行槽位。
3. 准备 output、browser、logs 和权限数据。
4. 打开或复用目标浏览器。
5. 发送结构化 `run.start` payload。
6. 把 Host 消息转换为现有 `onLog`、`SandboxRunResult` 和 Task Monitor 事件。
7. run 终态后释放浏览器占用和执行槽位。

执行槽位必须在打开浏览器之前取得，避免 queued run 提前占用浏览器窗口。

`StartedSandboxScriptRun.worker` 当前没有外部消费者，目标实现应移除该字段或替换成不暴露底层进程的 opaque handle。调用方只依赖：

```ts
interface StartedSandboxScriptRun {
  runId: string
  browserUrl?: string
  browserType?: 'chromium' | 'firefox'
  dirId?: string
  profile: SandboxProfile
  outputDir: string
  logFilePath?: string
  finished: Promise<SandboxRunResult>
  stop: () => void
}
```

### 4.3 Sandbox Host（sandbox 模式进程）

`src/modes/sandbox.ts` 从一次性 runner 改造成常驻 Host：

- 启动后校验 IPC channel。
- 初始化进程级 host logger 和健康监控。
- 发送 `host.ready`。
- 监听 `run.start`、`run.abort`、`host.drain`、`host.shutdown`。
- 维护 `runId -> SandboxRunSession`。
- 定时发送 heartbeat。
- Host 进入 draining 后拒绝新 run，等待现有 run 清理完成再退出。

不再从单次运行的 CLI 参数或 `SANDBOX_*` 环境变量初始化执行上下文。CLI 可保留显式 run-once 兼容入口，但生产链路只使用 IPC daemon 模式。

### 4.4 SandboxRunSession（Sandbox Host）

建议新增 `src/core/sandbox/sandbox-run-session.ts`，每个 run 创建一个实例。

```ts
interface SandboxRunSession {
  readonly runId: string
  readonly payload: SandboxRunPayload
  readonly state: SandboxRunState
  readonly context: vm.Context
  readonly moduleCache: Map<string, vm.Module>
  readonly abortController: AbortController
  readonly timers: Set<NodeJS.Timeout>
  readonly immediates: Set<NodeJS.Immediate>
  readonly browserConnections: Set<SandboxBrowserConnection>
  readonly writtenPaths: Set<string>
  readonly storageChanges: Map<string, StorageChangeAccumulator>
  readonly processEvents: EventEmitter
  run(): Promise<SandboxHostRunResult>
  abort(reason?: unknown): void
  dispose(): Promise<void>
}
```

session 是所有 run-scoped 状态的唯一所有者。禁止把 runId、outputDir、permissions、browserUrl、profile 或 logFilePath 写入 Host 的全局变量或 `process.env`。

## 5. IPC 协议

### 5.1 通用规则

- 协议使用 `protocolVersion: 1`。
- 所有 run 消息必须携带 `runId`。
- 所有 Host 消息必须携带 `generation`，防止旧进程迟到消息污染新 Host。
- payload 必须可 JSON 序列化，不传函数、BigInt、AbortSignal、Browser 对象或 VM 对象。`options` 保持现有 JSON 参数契约。
- 单条消息保持小尺寸；脚本源码继续通过本地路径读取，不经 IPC 传输。
- `run.finished` 是单个 run 的唯一终态消息。
- 日志和产物消息可以增量发送，但终态消息必须包含完整结果摘要。

建议新增 `src/core/sandbox/host-protocol.ts`，集中定义并校验双向消息。禁止继续在边界使用无校验的 `any`。

### 5.2 Agent 到 Host

#### run.start

```ts
interface SandboxRunStartMessage {
  type: 'run.start'
  protocolVersion: 1
  generation: string
  runId: string
  payload: SandboxRunPayload
}

interface SandboxRunPayload {
  scriptPath: string
  scriptSha512?: string
  assetSlug: string
  profile: 'debug' | 'release'
  dirId?: string
  browserUrl: string
  browserType: 'chromium' | 'firefox'
  options: unknown
  permissions: {
    version: 1
    fs: { read: string[] }
    fetch: { allow: string[] }
  }
  outputDir: string
  browserOutputDir: string
  logsDir: string
  logFilePath: string
  workspaceDir?: string
}
```

Host 必须校验：

- generation 与当前 Host 一致。
- runId 非空且未存在。
- scriptPath 必须是已由 agent 解析和校验的绝对本地路径；远程脚本必须先在 agent 侧下载和验证，Host 不直接接收 URL。
- outputDir、browserOutputDir、logsDir 和 logFilePath 必须位于当前脚本对应的 agent workdir 边界内。
- workspaceDir 和 permission sidecar 中的外部只读路径按各自现有策略单独校验，不能用 workdir 规则误拒绝。
- browser URL 为允许的 `ws:` 或 `wss:` endpoint。
- permissions 通过 `parseScriptPermissions()`。
- profile、browserType 和 options 满足协议 schema。

#### run.abort

```ts
interface SandboxRunAbortMessage {
  type: 'run.abort'
  protocolVersion: 1
  generation: string
  runId: string
  reason: 'user' | 'task' | 'timeout' | 'shutdown'
}
```

重复 abort 必须幂等。未知或已经完成的 runId 返回诊断消息，但不能导致 Host 退出。

#### host.drain

```ts
interface SandboxHostDrainMessage {
  type: 'host.drain'
  protocolVersion: 1
  generation: string
  reason: 'idle' | 'max-runs' | 'rss' | 'upgrade' | 'agent-shutdown'
}
```

Host 收到后不再接受新 run。普通回收等待活跃 run 完成；agent shutdown 可以随后升级为 `host.shutdown`。

#### host.shutdown

```ts
interface SandboxHostShutdownMessage {
  type: 'host.shutdown'
  protocolVersion: 1
  generation: string
  graceMs: number
}
```

Host abort 所有 run，并在 grace 到期前完成清理和退出。agent 仍需保留 SIGTERM/SIGKILL 兜底。

### 5.3 Host 到 Agent

#### host.ready

```ts
interface SandboxHostReadyMessage {
  type: 'host.ready'
  protocolVersion: 1
  generation: string
  pid: number
  startedAt: number
}
```

#### host.heartbeat

```ts
interface SandboxHostHeartbeatMessage {
  type: 'host.heartbeat'
  protocolVersion: 1
  generation: string
  pid: number
  timestamp: number
  activeRunIds: string[]
  completedRunCount: number
  memory: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
}
```

heartbeat 必须由 Host 主事件循环发送。同步脚本阻塞事件循环时 heartbeat 同时停止，agent 可据此识别整个 Host 不健康。

#### run.started

Host 完成 payload 校验并注册 session 后发送。收到该消息前 Host 异常退出，父进程仍按 startup failure 归并。

#### run.log

```ts
interface SandboxRunLogMessage {
  type: 'run.log'
  protocolVersion: 1
  generation: string
  runId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: number
}
```

#### run.artifacts

```ts
interface SandboxRunArtifactsMessage {
  type: 'run.artifacts'
  protocolVersion: 1
  generation: string
  runId: string
  paths: string[]
  changes: SandboxStorageChange[]
}
```

#### run.finished

```ts
interface SandboxHostRunFinishedMessage {
  type: 'run.finished'
  protocolVersion: 1
  generation: string
  runId: string
  result: {
    status: 'done' | 'failed' | 'killed' | 'timeout'
    exitCode: number | null
    returnValue?: string
    reportedPaths: string[]
    changes: SandboxStorageChange[]
    error?: {
      name: string
      message: string
      stack?: string
      code?: string
    }
  }
}
```

Agent 收到终态后再执行现有的 artifact stat、分类、LoginRequired 归一化、Task Monitor 发布和 `occupiedDirIds` 释放。

## 6. Host 生命周期

### 6.1 状态机

```text
stopped
  -> starting
  -> ready
  -> draining
  -> stopping
  -> stopped

starting/ready/draining/stopping
  -> crashed
  -> stopped
```

规则：

- `starting` 期间所有调用等待同一个 startup promise。
- `ready` 才允许分配新 run。
- `draining` 不接受新 run；新请求等待下一 generation。
- `stopping` 等待退出并设置强杀 timer。
- `crashed` 先归并旧 generation，再允许创建新 generation。
- 不允许两个 Host 同时属于同一 agent generation。

### 6.2 懒启动

第一个 sandbox run 到来时启动 Host。agent 启动不预热 sandbox，避免没有脚本任务时产生空闲进程成本。

建议启动参数：

```ts
fork(env.AGENT_SCRIPT_PATH, ['sandbox'], {
  env: buildSandboxHostEnv({
    generation,
    mode: 'sandbox',
    agentDataPaths,
  }),
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  execArgv: [
    '--experimental-strip-types',
    '--experimental-vm-modules',
  ],
  execPath: process.execPath,
})
```

单次 run 数据不得通过 Host 环境变量注入。

`buildSandboxHostEnv()` 必须使用显式 allowlist，只传 bundle 启动、agent 数据路径、语言和基础诊断所需的 Host 级配置。不得默认展开整个 `process.env`。迁移第一阶段如果因现有顶层模块初始化暂时需要继承凭据，必须记录为过渡状态，并在 LLM RPC 完成后删除；凭据最小化是 production 默认切换的前置条件。

### 6.3 空闲回收

建议默认参数：

| 常量 | 默认值 | 说明 |
| --- | ---: | --- |
| `SANDBOX_HOST_IDLE_TIMEOUT_MS` | 300000 | 无 active run 且无等待请求时，5 分钟后退出 |
| `SANDBOX_HOST_MAX_COMPLETED_RUNS` | 100 | 达到后进入 draining |
| `SANDBOX_HOST_RSS_SOFT_LIMIT_MB` | 512 | 无 active run 时回收；有 active run 时进入 draining |
| `SANDBOX_HOST_RSS_HARD_LIMIT_MB` | 768 | 立即停止接单并要求限时清理 |
| `SANDBOX_HOST_SHUTDOWN_GRACE_MS` | 5000 | 正常关闭宽限 |
| `SANDBOX_HOST_FORCE_KILL_MS` | 3000 | SIGTERM 后强杀等待 |
| `SANDBOX_RUN_ABORT_GRACE_MS` | 5000 | 单 run cooperative abort 等待；超时后回收整个 Host |

常量应由一个配置模块集中维护。若需要环境变量覆盖，必须在 agent 启动时解析、校验并记录最终值，不能在 Host 内散落读取。

### 6.4 周期性回收

长期进程可能积累：

- 未释放的 Playwright/native handle。
- 模块单例状态。
- VM 跨 realm 引用。
- 未被发现的 timer/listener。
- Buffer/external memory。

因此 Host 不能无限运行。达到 max-runs、RSS soft limit 或部署升级时进入 draining；活跃 run 清空后退出，由下一个请求创建新 generation。

## 7. Run 生命周期

### 7.1 状态机

```text
accepted
  -> starting
  -> running
  -> stopping
  -> done | failed | killed | timeout
```

终态必须只产生一次。`dispose()` 无论成功、失败、abort 还是 Host drain 都必须执行。

### 7.2 正常执行

1. Host 校验 payload 并注册 session。
2. 创建 per-run logger、permissions、timer registry 和 browser registry。
3. 读取脚本并校验 SHA-512。
4. 创建 VM context 和 module linker。
5. 为本 run 创建 sandbox API 工厂实例。
6. link/evaluate module。
7. 调用 `main(options)`。
8. 校验返回值为 string 或 undefined。
9. 上报 returnValue、written paths 和 storage changes。
10. 清理 browser、timer、listener、module cache 和 context 引用。
11. 发送唯一 `run.finished`。

### 7.3 Abort

abort 是两阶段过程：

1. cooperative abort：触发 session AbortController，取消 fetch/LLM，关闭本 run 浏览器连接，清理 timers。
2. process fallback：如果 run 在 grace 内未结束，agent 判定 Host 可能被同步代码阻塞，杀死整个 Host。

Sandbox Host 无法在事件循环完全阻塞时单独终止某个 VM。这是直接 VM 方案的固有限制。

Host 被强杀时：

- 目标 run 映射为 `killed` 或调用方 signal 对应的 interrupted 语义。
- 同 Host 其他活跃 run 同样映射为 `killed`，错误原因注明 `sandbox_host_terminated`。
- queued 但尚未发送到 Host 的 run 保留在 agent 队列，等待新 Host。
- 已发送 `run.start` 但未终态的 run 不自动重试，避免浏览器操作重复执行。

### 7.4 状态和 exitCode 兼容映射

常驻 Host 下的 `SandboxRunResult.exitCode` 是 run-local 兼容字段，不再代表真实 Sandbox Host 进程退出码：

| 场景 | status | exitCode |
| --- | --- | ---: |
| `main()` 正常完成 | `done` | 0 |
| 脚本异常或校验失败 | `failed` | 1 |
| 虚拟 `process.exit(code)` | code 为 0 时 `done`，否则 `failed` | code |
| cooperative abort 按现有超时语义归并 | `timeout` | 124 |
| Host heartbeat 超时、crash 或强杀 | `killed` | null |
| `LoginRequired` | agent 收到 done 后归一化为 `failed` | 0 |

上层如果已有 AbortSignal 已触发，继续优先输出 interrupted 用户语义，不依赖 `status=timeout` 文案。

### 7.5 `process.exit()` 语义

注入 VM 的 `process.exit()` 不能再退出真实 Sandbox Host。目标实现应把它转换为 run-local 退出请求：

- 标记 session exiting。
- 触发清理。
- 以传入 code 归并当前 run。
- 不影响其他 VM。

实现可使用私有 `SandboxExitError` sentinel，但所有注入 timer 回调也必须经过 session wrapper，保证异步回调中的 sentinel 不会成为 Host 级 uncaught exception。

## 8. 并发模型

### 8.1 全局并发上限

现有任务定义可以请求较高 concurrency，但实际 Host 并发必须有独立全局上限：

```text
effective concurrency = min(task concurrency, SandboxHost global capacity)
```

建议默认 `SANDBOX_HOST_MAX_CONCURRENCY = min(8, max(2, os.cpus().length))`。最终数值应通过 Windows/macOS 目标机器压测确定。

Host 内的并发是异步交错，不是 CPU 并行。浏览器 I/O任务可以受益，CPU密集或同步脚本会阻塞全部 session。

### 8.2 排队位置

执行槽位由 agent 侧 `SandboxHostManager` 分配，原因是：

- queued run 不应提前打开浏览器。
- queued run 可以在没有启动 Host 时被 AbortSignal 取消。
- Host crash 不应丢失尚未投递的请求。
- agent 更容易统一协调多个 conversation 和 task 的公平性。

推荐 FIFO，后续如需优先级可在协议之外扩展 scheduler，不修改 Host。

### 8.3 同 assetSlug 写冲突

多个窗口运行同一脚本时共享 `workdir/{slug}`。table/kv 当前以文件形式长期保存，并发写同一文件可能产生 lost update。

目标 Host 应提供进程级 `SandboxStorageCoordinator`：

- table/kv 按 canonical file path 使用 async mutex。
- read-modify-write 整段操作持锁。
- 任意 fs 写仍由调用者承担业务冲突，但 wrapper 记录准确 written path。
- browser artifact 使用 run-scoped 子目录，避免同名截图冲突。

推荐浏览器产物目录：

```text
workdir/{slug}/browser/{yyyy-mm-dd}/{runId}/
```

如果必须保持现有日期目录结构，Playwright AssetManager 的 collision strategy 必须保证不覆盖，同时产物归属以 session 记录路径为准。

## 9. 进程级共享状态改造

### 9.1 禁止 `process.chdir()`

迁移前 sandbox 使用真实 `process.chdir(outputDir)`，长期 Host 内不能继续使用：

- cwd 是进程全局状态。
- 并发 run 会相互覆盖。
- Host 自身依赖和日志也会受到影响。

目标实现：

- 真实 Host cwd 启动后不再变化。
- 虚拟 `process.cwd()` 固定返回当前 session outputDir。
- 为每个 session 创建 path facade；`resolve()` 收到相对路径时显式以 session outputDir 为根，不能透传依赖真实 Host cwd 的原生行为。
- 注入的 fs wrapper 把相对路径解析到当前 session outputDir。
- Playwright 连接显式传入 per-run asset directories。

### 9.2 禁止 run 配置写入 `process.env`

以下变量当前属于单次 run，目标 Host 内不得再依赖：

```text
SANDBOX_RUN_ID
SANDBOX_ASSET_SLUG
SANDBOX_DIR_ID
SANDBOX_DEBUG
SANDBOX_OUTPUT_DIR
SANDBOX_BROWSER_DIR
SANDBOX_WORKSPACE_DIR
SANDBOX_LOGS_DIR
SANDBOX_LOG_FILE
SANDBOX_PERMISSIONS
SANDBOX_OPTIONS
SANDBOX_SCRIPT_SHA512
BROWSER_URL
BROWSER_TYPE
ROXY_PLAYWRIGHT_SCREENSHOTS_DIR
```

它们全部进入 `SandboxRunPayload` 和 session。注入脚本的虚拟 `process.env` 仍只暴露：

```text
BROWSER_URL
BROWSER_TYPE
SANDBOX_DEBUG
```

### 9.3 虚拟 process

迁移前 `buildSandboxProcess()` 透传了真实 process 的事件 API。当前多 VM Host 已改为 session-local facade：

- `on/once/off/emit` 绑定 session 自己的 EventEmitter。
- `exit` 只结束当前 run。
- `stdout/stderr` 是写入当前 run logger 的安全 sink，不暴露真实 stream。
- `cwd/env/argv` 为 session 快照。
- `pid/platform/arch/version` 可以只读透传。
- `kill/send/disconnect/binding/dlopen/chdir` 继续 neutralize。
- run dispose 时移除 session EventEmitter 的全部 listener。

禁止脚本向真实 Host process 注册 signal、uncaughtException、beforeExit 或 exit listener。

### 9.4 Timer registry

注入 VM 的 timer 必须按 session 包装：

- `setTimeout/setInterval/setImmediate` 注册 handle。
- callback 执行前检查 session 是否 active。
- callback 异常进入当前 session 的失败归并，而不是 Host uncaught exception。
- `clear*` 同时从 registry 删除。
- abort/dispose 清除所有剩余 handle。

不注入未被 registry 管理的宿主 timer 函数。

## 10. 文件系统权限

### 10.1 约束变化

Node permission flags 在进程启动时确定，不能对同一个长期 Host 中的不同 run 动态设置不同 `fs.read` allowlist。因此目标实现不能继续把每个 permission sidecar 直接翻译为本次子进程的 `--allow-fs-read` 参数。

文件边界改为 per-session fs capability。这个变化必须在实现和文档中明确，不应继续声称“每个 run 由独立 Node process permission flags 强制”。

Host 仍可使用一套固定、粗粒度的 Node permission flags 限制 bundle、agent 数据根目录、日志和 workdir，但它不能表达不同 run 的动态外部只读路径。脚本级授权和路径归属仍由下面的 fs capability 执行。

当前实现已经将相对路径映射到 run 的 outputDir，并预留 `authorizePath` 与 `readAllowlist` 扩展点；按本次实现范围，绝对路径 allowlist、canonical realpath 和 symlink 强制策略尚未启用。因此当前 fs facade 是路径归属与后续权限策略的接入点，不是强安全边界。

### 10.2 fs capability 完整策略目标

`createSandboxFsModules()` 改为接收：

```ts
interface CreateSandboxFsOptions {
  outputDir: string
  readAllowlist: string[]
  onWrite(path: string): void
  authorizePath(path: string, access: 'read' | 'write'): void
}
```

路径规则：

- 相对路径以 outputDir 为根。
- outputDir 内允许读写。
- sidecar `fs.read` 只允许读，不允许写。
- 其他路径拒绝。
- 双路径操作分别校验 source 和 destination。
- 路径比较使用 canonical absolute path 和 `path.relative()`，不能使用字符串前缀。
- 处理已存在路径时使用 realpath，避免 symlink 逃逸。
- 创建新路径时校验最近存在父目录的 realpath。
- 默认拒绝创建 symlink、hard link、device file 和未支持的特殊文件。

第一阶段应明确支持脚本实际需要的 API：

- `readFile/readFileSync`
- `writeFile/writeFileSync`
- `appendFile/appendFileSync`
- `mkdir/mkdirSync`
- `readdir/readdirSync`
- `stat/statSync/lstat/lstatSync`
- `access/accessSync`
- `rm/rmSync/unlink/unlinkSync`
- `rename/renameSync`
- `copyFile/copyFileSync`
- `open/openSync`
- `createReadStream/createWriteStream`
- `fs.promises` 对应方法

未明确包装并校验的 path-taking API 不应原样透传。实现前需要扫描已有官方和用户脚本的 fs 使用面，补齐兼容清单。

### 10.3 安全说明

VM 和 JavaScript fs wrapper 不是与独立受限进程等价的强安全边界。Host 与 agent 分进程降低了 agent 可用性风险，但 Sandbox Host 仍以当前 OS 用户身份运行。

因此还需要：

- Host 不持有非必要凭据。
- Host 环境变量最小化。
- 不向 VM 暴露真实 process、module loader 或任意 native binding。
- 保留脚本来源、SHA-512 和模块白名单校验。
- 对 VM escape 风险进行独立安全评审。

如果未来要求每个脚本拥有不可绕过、动态变化的 OS/Node 文件权限，必须恢复每 run 独立进程或引入更强隔离机制；常驻单进程多 VM 无法提供相同保证。

## 11. Fetch、LLM 与凭据

### 11.1 Fetch

fetch allowlist 已经是 run-scoped，继续为每个 session 创建 restricted fetch：

- 使用本 run permissions。
- 只允许 HTTP(S)。
- redirect 保持 `manual`。
- 合并 session AbortSignal。
- abort 后拒绝新请求。

### 11.2 LLM

迁移前 sandbox LLM transport 在 sandbox 进程内构造 provider，需要读取 agent API 配置。当前实现已改为 Host -> Agent RPC，Host 不再持有模型凭据。

当前调用链：

```text
VM llm.ask()
  -> Sandbox Host sends rpc.llm.request(runId, requestId, request)
  -> Agent invokes provider
  -> Agent sends rpc.llm.response
  -> Host resolves current run promise
```

要求：

- requestId 在 run 内唯一。
- agent 校验 generation 和 runId。
- run abort 时取消对应 provider request。
- Host crash 时 agent 清理该 generation 的全部请求。
- response 不得发送给已结束或不同 generation 的 run。

如果第一阶段暂时保留 Host 内 LLM，必须记录为过渡状态，并保证虚拟 `process.env` 不向脚本暴露真实凭据。

## 12. Playwright 隔离

### 12.1 per-run facade

当前直接向 VM 注入全局 `chromium` 和 `firefox`，并通过进程环境变量设置截图目录。目标实现应为每个 session 注入 facade：

```ts
createSandboxPlaywrightFacade({
  browserUrl,
  browserType,
  artifactsDir: outputDir,
  screenshotsDir: browserOutputDir,
  downloadsDir: browserOutputDir,
  onConnected(browser) {
    session.browserConnections.add(browser)
  },
})
```

Roxy Playwright 的 `connect(endpoint, options)` 支持 asset options，应显式传入目录，不能修改 `ROXY_PLAYWRIGHT_*` 环境变量。

### 12.2 精确清理

禁止 run 结束时调用进程级 `firefox.disconnectAll()`，因为它可能断开其他 session 的连接。

每个 facade 必须记录本 run 返回的 Browser/BrowserContext/Page 或底层连接，并在 dispose 时只关闭或 disconnect 当前 run 拥有的对象。

清理顺序：

1. 阻止创建新连接。
2. 取消当前 run 的等待操作。
3. 关闭当前 run page/context。
4. disconnect 当前 run browser。
5. 从 session registry 移除引用。

当前实现不依赖进程级 `firefox.disconnectAll()`：facade 记录 `firefox.connect()` 返回的 browser，并在当前 run dispose 时关闭该 browser。

## 13. 日志与诊断

### 13.1 Host 日志

Sandbox Host 使用独立进程日志，例如：

```text
logs/sandbox-host/{yyyy-mm-dd}.log
```

内容包括：

- Host generation、pid、启动和退出原因。
- active/queued run 数量。
- heartbeat 和内存采样。
- uncaught exception、unhandled rejection。
- IPC schema error。
- runId 与脚本 slug 的绑定关系，不记录敏感 options。

### 13.2 Run 日志

继续使用：

```text
workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log
```

注入 VM 的 console 直接写当前 run logger，并发送 `run.log`。

Host 全局 console 可以结合 `AsyncLocalStorage<SandboxRunLogContext>`：

- session 执行链中的依赖 console 输出写入对应 run log。
- 没有 active context 的输出写 Host log。
- 直接 `process.stdout.write()` 无法可靠归属 run，只进入 Host stdout/Host log，不作为 run log保证。

### 13.3 指标

至少记录：

- Host startup duration。
- VM create/link/evaluate/main/dispose duration。
- active、queued、completed、failed、killed run 数。
- Host RSS、heapUsed、external memory。
- event-loop delay。
- Host recycle reason。
- heartbeat timeout count。
- run abort grace exceeded count。
- artifact count/bytes。

## 14. 健康检查与故障归并

### 14.1 Heartbeat

建议：

| 常量 | 默认值 |
| --- | ---: |
| `SANDBOX_HOST_HEARTBEAT_INTERVAL_MS` | 1000 |
| `SANDBOX_HOST_HEARTBEAT_TIMEOUT_MS` | 10000 |

Agent 每次收到 heartbeat 更新 generation 的 lastSeen。超过 timeout：

1. 标记 Host unhealthy。
2. 停止向其投递新 run。
3. 记录 active run 快照和内存信息。
4. 发送 SIGTERM。
5. force-kill timer 到期后发送 SIGKILL。
6. 归并该 generation 的 pending run。
7. 允许下一个请求启动新 Host。

### 14.2 Host error/exit/disconnect

`error`、`exit` 和 `disconnect` 可能以不同顺序到达。Manager 必须使用单一 `finalizeHostGeneration()` 幂等收口，避免重复 resolve、重复释放 slot 或重复发布 Task Monitor 终态。

### 14.3 Uncaught exception

Host 收到 `uncaughtException` 或 `unhandledRejection` 时不继续长期服务：

- 尝试发送 `host.fatal`。
- 进入 draining/stopping。
- 不接受新 run。
- agent 最终负责退出兜底。

继续运行可能留下未知的跨 session 状态，不符合可恢复设计。

## 15. 产物与持久状态

### 15.1 精确写入追踪

每个 session 通过以下来源记录路径：

- fs capability 的 onWrite。
- table/kv 的 onChange。
- debug/download API。
- Playwright asset facade。

正常完成时以 session 的精确路径集为主，不依赖全 workdir递归扫描确定归属。

### 15.2 扫描兜底

递归扫描仍可作为 Host crash 或旧 API 漏报的兜底，但同一 slug 并发时 mtime 无法严格区分 run。扫描结果必须标记为 best-effort，不能覆盖精确追踪结果。

### 15.3 Table/KV

Table/KV 继续持久化在 `workdir/{slug}`。Host 内共享 coordinator 负责串行化同一路径操作。session dispose 只释放 API 实例和锁等待，不删除持久数据。

## 16. 兼容性

### 16.1 保持不变

- `roxy_script_run` 工具输入输出。
- Script 任务执行器调用方式。
- `SandboxRunStatus` 和 `SandboxRunResult`。
- `LoginRequired` 语义。
- Task Monitor 和 task execution event。
- artifact 上传和 file collector。
- 同一 `dirId` 同时只允许运行一个脚本。
- agent、worker、sandbox 同 bundle。

### 16.2 需要更新

- sandbox 不再是每 run 一个进程。
- sandbox mode 不再依赖单次运行的环境变量和 argv。
- `process.exit()` 只结束当前 run。
- `process.cwd()` 是虚拟值，真实 Host cwd 不变化。
- fs 权限从 per-process Node flags 改为 per-session capability。
- stdout/stderr 的 fallback 日志只保证进入 Host 日志。
- Firefox 连接清理必须从全局改为 per-run。

### 16.3 文档同步

实现时必须同步：

- `packages/roxy-agent/CLAUDE.md`
- `packages/roxy-agent/AGENTS.md`
- `packages/roxy-skills/src/automation-script-writing/SKILL.md`
- `packages/roxy-skills/src/automation-script-writing/references/runtime.md`
- `packages/roxy-skills/src/automation-script-writing/references/sandbox-api.d.ts`
- `roxy_script_run` 工具描述中“forked child process”文案

## 17. 建议代码结构

```text
src/
├── services/
│   ├── sandboxHostManager.ts       # Host 生命周期、IPC、heartbeat、并发槽位
│   └── sandboxService.ts           # 浏览器、路径、产物、业务结果协调
├── core/sandbox/
│   ├── host-protocol.ts            # 双向 IPC schema/type guard
│   ├── sandbox-run-session.ts      # 单 run 生命周期
│   ├── sandbox-runtime.ts          # VM context 与虚拟 process
│   ├── sandbox-fs.ts               # run-scoped fs capability
│   ├── sandbox-playwright.ts       # run-scoped Playwright facade
│   ├── sandbox-timers.ts           # timer registry
│   ├── sandbox-storage.ts          # table/kv 路径锁
│   └── script-entry.ts
└── modes/
    ├── sandbox.ts                  # 常驻 Host 消息循环
    └── sandbox-api/
```

抽象只应在确实承载隔离职责时增加。Host manager 不应吸收现有 `sandboxService` 的浏览器和 artifact 业务逻辑。

## 18. 迁移计划

### Phase 0：对齐并冻结当前契约（已完成）

- 处理当前 permission flags 代码、测试和运行时文档不一致的问题，明确旧 per-run 模型和目标 persistent Host 模型各自的实际安全边界。
- 为 `SandboxRunResult`、LoginRequired、artifact、abort 和 Task Monitor 添加回归用例。
- 记录当前 cold run、warm run、并发运行的启动时间和 RSS 基线。

### Phase 1：协议和 Host manager（已完成）

- 增加 versioned Host IPC 协议。
- 增加 `SandboxHostManager`。
- sandbox mode 改为常驻消息循环。
- 增加可配置并发槽位，默认 `SANDBOX_HOST_MAX_CONCURRENCY=2`。
- 保持大部分现有 VM runner 逻辑，每次 run完成后不退出进程。
- 加入 idle shutdown、Host crash 归并和 generation 防串线。

目标：先验证进程复用、消息协议和生命周期，不同时解决并发共享状态。

### Phase 2：Session 化共享状态（主链路已完成）

- 移除 `process.chdir()`。
- 移除 run-scoped `process.env`。
- 引入虚拟 process、fs capability、timer registry。
- logger 改成 Host log + run log。
- Playwright 改成 per-run facade 和精确连接清理。
- LLM transport 改为 run-scoped，优先 RPC 回 agent。

目标：两个 VM 可以在同一 Host 安全异步并发，不发生路径、日志、浏览器和 timer 串扰。

### Phase 3：受控并发（部分完成）

- 增加 agent 侧全局 semaphore。
- 增加 storage coordinator。
- 并发从 1 灰度提升到 2、4，再根据压测决定是否到 8。
- 增加 heartbeat、event-loop delay 和 abort hard fallback。

当前已完成 Agent 侧 FIFO semaphore、heartbeat 和 abort hard fallback；table/kv 同路径 storage coordinator 与 event-loop delay 指标仍待补充。

### Phase 4：资源回收和默认切换（已完成）

- 增加 RSS/max-runs/idle recycle。
- 加入可观测指标和异常摘要。
- 默认启用常驻 Host。
- 已删除旧 per-run fork 启动路径和旧 run-scoped sandbox env。

## 19. 回滚策略

当前版本只保留 `persistent-host` 执行路径，不同时维护 per-run process feature flag。若线上需要回滚，应回退 Agent bundle 版本；调用方 API、脚本入口和 workdir 数据结构保持兼容。

## 20. 测试计划

### 20.1 单元测试

- IPC schema、protocolVersion 和 generation 校验。
- Host manager startup promise 合并。
- run.finished 幂等归并。
- error/exit/disconnect 不同顺序。
- queue abort 和 slot 释放。
- idle、max-runs、RSS recycle。
- 虚拟 cwd/env/process event隔离。
- fs 相对路径、外部只读、外部写拒绝、symlink 逃逸。
- timer 注册和 dispose。
- Playwright facade 合并 asset options。
- per-run browser 精确 disconnect。
- table/kv 同路径锁。

### 20.2 集成测试

- Host 启动后连续运行多个脚本，pid 不变化。
- 两个不同 slug VM 并发写文件和日志，不串线。
- 同 slug 多窗口并发 table/kv 不丢更新。
- Chromium 与 Firefox 并发连接互不清理。
- run abort 只结束目标 run。
- cooperative abort 失败后 agent 杀 Host，所有 active run 正确归并。
- 同步死循环导致 heartbeat timeout，Host 被强杀并自动重建。
- Host 在 `run.started` 前、运行中和发送终态后退出。
- `process.exit()`只结束当前 VM。
- Host recycle 后新 generation 不接收旧消息。
- LoginRequired、returnValue、artifact 和 run outputs 与旧实现一致。
- agent shutdown 时 Host 和 active run 有界退出。

### 20.3 打包验证

- Electron 开发环境的 `agent.mjs`。
- OSS 下发的生产 `roxy-agent.mjs`。
- macOS、Windows 各自的 IPC、路径大小写、路径分隔符和进程信号行为。
- 同一个 bundle 的 agent、worker、sandbox 三种 mode 分发无回归。

### 20.4 性能验收

对比旧 per-run process 和 persistent Host：

- 首次 run ready time。
- 第 2 到第 100 次 warm run ready time。
- 1、2、4、8 并发时 agent + sandbox 总 RSS。
- run 完成后的 RSS 回落。
- 100 次运行后的 handle、listener、timer 和 browser connection 数量。
- Host recycle 时间和下一个 run 恢复时间。

性能目标不在设计阶段写死百分比；先建立基线，再以目标机器数据确定阈值。必须保证性能优化不以文件越权、日志串线、任务错误归并或 agent 可用性退化为代价。

## 21. 验收标准

实现完成需要同时满足：

1. 正常连续运行至少 100 次只复用一个 Sandbox Host pid，达到回收条件后可平滑换代。
2. 多 VM 并发时 outputDir、日志、permissions、options、browser endpoint 和产物不串线。
3. agent 进程不直接持有 VM，也不会被脚本同步死循环阻塞。
4. heartbeat timeout 能在有界时间内杀死并重启 Host。
5. Host 异常退出不会留下未 settle promise、occupied dirId 或并发 slot。
6. 单次 run 只发布一个终态，Task Monitor 只发布一次 browser finished。
7. `LoginRequired`、abort、timeout、killed 和普通失败与现有调用方语义兼容。
8. 不使用 run-scoped `process.chdir()` 或真实 `process.env` 修改。
9. 不调用会影响其他 run 的全局 browser cleanup。
10. fs capability 和 symlink 边界通过安全测试。
11. 同 bundle 的三种 mode 均完成开发和生产产物验证。
12. 文档、Skill runtime reference 和实现保持一致。

## 22. 已知风险与后续决策

### 22.1 同步阻塞影响所有 run

这是本架构最主要的可用性风险。通过低并发上限、heartbeat、Host 强杀和自动重启降低影响，但不能实现单 VM硬终止。

### 22.2 VM 不是强安全边界

Host 进程隔离保护 agent 可用性，但不能把 VM描述为 OS sandbox。文件 wrapper、模块白名单和凭据最小化必须同时落地。

### 22.3 Firefox 单连接清理能力

Firefox 清理必须保持 run-scoped：只能关闭当前 run 通过 `firefox.connect()` 获得并登记的 browser，不能调用会影响其他 run 的进程级 `disconnectAll()`。

### 22.4 动态外部文件权限

长期 Host 无法按 run 修改 Node process permission flags。本设计选择 run-scoped fs capability。若产品要求不可绕过的外部路径隔离，需要重新评估进程模型。

### 22.5 公平调度

第一版使用 FIFO。若定时任务、大批量多窗口任务和交互式会话互相饥饿，再增加按来源加权调度，不把该复杂度提前放入 Host。

## 23. 最终结论

目标实现采用：

```text
Agent process
  -> lazy, recyclable Sandbox Host child process
       -> multiple session-scoped VM contexts on one event loop
```

它用一个可独立强杀和重启的进程承载所有 sandbox VM，避免每次脚本运行重复创建 Node 进程，同时不把 VM 和同步阻塞风险引入 agent 主进程。

实现成败取决于是否彻底移除 run-scoped 进程全局状态。`process.chdir()`、真实 `process.env`、全局 logger、全局 Firefox cleanup、未跟踪 timer 和原生 fs 直通必须在启用多 VM并发前完成 session 化；否则“复用一个进程”只会把原本被进程隔离的问题转换为跨 run 污染。
