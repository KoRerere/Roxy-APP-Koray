# CLAUDE.md

本文件为 Claude Code 提供在 `packages/roxy-agent` 中工作的指导。

## 生产环境启动方式（重要）

**roxy-agent 在生产环境中不是独立进程，而是由 Electron 主进程通过 `utilityProcess.fork()` 作为子进程启动的。**

启动入口：`apps/electron/src/modules/mcp/index.ts` → `McpManager.startMcpServer()`

关键启动流程：

1. 等待 `agentUpdater` 完成更新检查，确保本地脚本与远端 sha512 匹配
2. 调用后端 API 获取 LLM 配置（provider/model/apikey）和 RoxyClaw（IM）配置
3. 通过 `getPortPromise` 动态分配端口（默认从 26580 开始）
4. 用 `utilityProcess.fork(AGENT_ENTRY_SCRIPT, [], { env, stdio: 'pipe' })` 启动

```typescript
// apps/electron/src/modules/mcp/index.ts
const worker = utilityProcess.fork(AGENT_ENTRY_SCRIPT, [], {
  env, // 所有环境变量由 Electron 主进程注入，agent 本身不读取 .env 文件
  execArgv: isDev ? ['--inspect=20580', '--experimental-network-inspection'] : [],
  stdio: 'pipe',
})
```

**环境变量由 Electron 注入**，具体值来源：

- LLM 模型配置：agent 运行时经 `/llm-proxy` 的 `agentModelApi.getUserModel()` 从后端拉取；RoxyClaw（IM）配置由后端接口获取
- `ROXY_API_KEY/HOST`：`store.apiKey` 和本地 API 端口（`http://127.0.0.1:{apiPort}`）
- `ROXY_SERVER_PORT`：动态分配的端口
- `ROXY_USER_ID/WORKSPACE_ID`：来自 `store`
- `CHECKPOINT_DIR`：`agentUpdater.agentDir + '/checkpoints'`
- `SKILLS_DIR`：`agentUpdater.agentDir`
- `DOWNLOADS_DIR`：`app.getPath('downloads')`（系统下载目录）
- `ROXY_MODE`：Electron 统一注入 `'agent'`；RoxyClaw（IM）作为同一 agent 进程内能力，按后端配置或父进程消息启动

**脚本路径**：

- 开发环境：`apps/electron/src/modules/mcp/` 下的 `agent.mjs`
- 生产环境：`appConfig.agentBinPath`（从 OSS 下载后的本地路径）

> 本地开发调试时（`tsx src/cli.ts`）才会读取 `.env` 文件。生产/打包环境下所有配置均由 Electron 主进程注入。

## 构建命令

```bash
vite build          # 构建到 dist-vite/（ES 模块，Node 22 SSR）
pnpm bundle         # rimraf + Webpack 打包到 dist/（发布用，混淆）
pnpm build          # 完整构建：vite build && pnpm bundle
tsx src/cli.ts      # 开发环境启动（读取 .env 文件）
node scripts/run-dist.mjs  # 运行编译产物（run:dist）
```

## 目录结构

```
src/
├── index.ts              # 应用入口，解析进程形态（agent/worker/sandbox）
├── app.ts                # Express 应用工厂，注册所有路由
├── config.ts             # 环境变量读取与默认值
├── cli.ts                # CLI 入口（转发到 index.ts）
├── api/                  # RoxyBrowser 本地 API 与 roxy-agent-server 类型安全客户端
├── llm/                  # LLM 集成层
│   └── index.ts          # createLLM()/createLLMFromModelInfo()：运行时从后端拉 UserModelInfo，按 api_format 建 LangChain 实例
├── deepagents/           # Agent 执行引擎（核心）
│   ├── index.ts          # AgentInstance 类型、chat/claw 工厂导出与 checkpoint 清理
│   ├── backend.ts        # createDeepAgentRuntime（工具/LLM/checkpoint 组装）
│   ├── handle-stream.ts  # 流式事件处理
│   ├── fileCollector.ts  # 工具调用产出文件收集
│   ├── sqlite-checkpointer.ts  # LangGraph checkpoint 持久化
│   ├── prompt/           # 主 Agent、IM 与 parallel worker 的系统提示词
│   ├── agent/            # 各类型 Agent 工厂
│   │   ├── chat.ts       # 普通对话 Agent
│   │   └── claw.ts       # Claw（RoxyClaw IM）Agent
│   ├── middlewares/      # LangGraph 中间件
│   │   ├── index.ts      # 统一导出
│   │   ├── browserOpsLogging.ts         # 浏览器操作日志（导出别名 createBrowserOperationLogMiddleware）
│   │   ├── disableSubagent.ts          # 禁用子 Agent（worker 模式）
│   │   ├── modelRetry.ts               # 模型调用重试
│   │   ├── skills.ts                   # Skills 动态注入
│   │   └── toolErrorFallback.ts        # 工具错误回退
│   └── tools/            # Agent 内置工具
│       ├── filesystem.ts     # 会话工作区文件工具
│       ├── run_worker.ts     # parallel_dispatch（fork 多个隔离 worker）
│       ├── run_script.ts     # run_script（执行用户脚本）
│       ├── list_scripts.ts   # list_scripts
│       ├── skill.ts          # load_skills
│       └── get_script_self_description.ts
├── core/                 # 基础设施层
│   ├── agent-channel/    # WebSocket 统一状态事件信道
│   ├── agent-events/     # canonical 会话事件、legacy SSE 迁移解码与 JSONL publisher
│   ├── agentError.ts     # AgentError 类型
│   ├── fileManager.ts    # 文件上传/下载管理
│   ├── skillManager.ts   # builtin/user/installed 本地 Skill 扫描与路径边界
│   ├── polyfill.ts
│   ├── logger.ts         # 文件日志（按日期轮转）
│   ├── i18n/             # 国际化
│   ├── mcp/              # MCP 客户端管理（替代原顶层 mcpManager.ts）
│   ├── registry/         # 工具注册表
│   ├── sandbox/          # Sandbox VM 运行时
│   │   ├── sandbox-runtime.ts   # VM 上下文、原生 fs 映射与受限 process
│   │   ├── llmTransport.ts      # 宿主侧 LlmTransport 实现（注入给 @roxybrowser/sandbox/llm）
│   │   └── sandbox-globals.d.ts # sandbox 注入模块/全局的类型声明
│   ├── skills/           # Skills 扫描与加载
│   └── worker/           # Worker 进程协议
│       ├── protocol.ts   # IPC 消息类型 + sendEvent/sendReady/sendResult
│       ├── payload.ts    # Worker 启动参数解析
│       └── workerRunner.ts
├── database/
│   ├── conversations/    # 对话与消息 SQLite 存储
│   │   └── index.ts      # ChatContextAPI + FileManager 数据访问
│   ├── tasks/            # 本地任务执行日志 SQLite（task_logs）
├── routes/               # Express 路由（路由层，不含业务逻辑）
│   ├── conversationRoutes.ts # /api/conversations CRUD
│   ├── fileRoutes.ts         # /api/upload, /api/files/:id
│   ├── mcpRoutes.ts          # /api/mcp/*
│   ├── scriptRoutes.ts       # /api/scripts/self-description（脚本自描述）
│   ├── taskRoutes.ts         # /api/tasks/*（执行日志、立即运行与同步）
│   └── roxyClawRoutes.ts     # /api/roxy-claw/*（IM 控制与连通性检查）
├── services/             # 业务逻辑层（被路由层调用）
│   ├── chatService.ts
│   ├── fileService.ts
│   ├── sandboxService.ts     # Sandbox 进程管理
│   ├── templateService.ts    # canonical 模板解析与远端 Skill 安全安装
│   ├── taskService.ts        # 任务路由业务协调
│   ├── taskExecutionDetails.ts # 任务执行事件重放
│   └── taskArtifacts.ts      # 任务文件产物归档
├── script/               # 脚本系统
│   ├── types.ts
│   ├── browserOpsManager.ts  # 会话 recording.jsonl 管理
│   ├── libraryStore.ts       # 本地脚本库
│   ├── remoteScriptPolicy.ts # 远程官方脚本地址策略
│   └── scriptMeta.ts         # 脚本自描述静态提取
├── tasks/                # 后端任务同步、UTC timer、lease 与执行器
├── im/                   # IM 平台适配器
│   ├── index.ts
│   ├── core/
│   │   ├── IMBridge.ts       # IM → Agent 桥接层
│   │   ├── threadManager.ts  # 频道 → 线程 ID 映射
│   │   ├── attachments.ts
│   │   ├── outputGuard.ts
│   │   └── StreamSender.ts
│   ├── discord/
│   ├── feishu/           # 飞书/Lark
│   ├── slack/
│   ├── telegram/
│   └── weixin/           # 微信公众号/企业微信
└── modes/
    ├── agent.ts          # HTTP 服务模式；可同时按配置启动 RoxyClaw IM 能力
    ├── worker.ts         # parallel_dispatch 子进程，通过 IPC 与父 Agent 通信
    └── sandbox.ts        # Sandbox 模式（隔离 VM 执行用户脚本，由 sandboxService fork）
```

## 核心架构

### 执行模式

应用通过 `ROXY_MODE` 环境变量或 CLI 第一个参数选择三种模式：

- **`agent`**（默认）：启动 Express HTTP 服务器，接收前端请求；RoxyClaw（IM）按配置在同一进程内启动
- **`worker`**：普通 chat agent 的并行子进程。由父进程 fork，通过 IPC 接收任务参数（`loadWorkerPayload()`），执行完成后将结果通过 `sendResult()` 写回父进程，自动退出
- **`sandbox`**：隔离 VM 模式。由 `services/sandboxService.ts` 用 `child_process.fork(agentEntry, [scriptPath], { env:{ ROXY_MODE:'sandbox', ... } })` 拉起，在受限的 `node:vm` 上下文（`SourceTextModule` + `SyntheticModule` + linker）中执行用户脚本：脚本先 `stripTypeScriptTypes` 去类型，`fetch`/`XMLHttpRequest` 置空（禁网），脚本自身 `import fs` 在 release profile 下惰性化。宿主经 `sandboxApis` 注入能力（见下节「Sandbox 脚本执行」）

### Agent 执行形态（`src/deepagents/`）

前端不再为会话选择 Simple、Orchestrator 或图片模式。每轮统一进入普通 conversation agent；需要多窗口并行时由其 `parallel_dispatch` 工具派发子 worker。worker 事件通过 canonical event 的 `workerId` 归组，主会话事件不带 `workerId`。

### MCP 集成（`src/core/mcp/mcpManager.ts`）

三类 MCP 客户端：

| 类型                                                  | 范围           | 传输方式                      |
| ----------------------------------------------------- | -------------- | ----------------------------- |
| OpenAPI MCP（`roxybrowser_openapi`）                  | 全局共享       | InMemoryTransport             |
| Playwright MCP（`roxybrowser_playwright_{workerId}`） | 每 Worker 隔离 | InMemoryTransport             |
| 用户自定义 MCP                                        | 全局可配置     | stdio / http                  |

生命周期：

```typescript
await mcpManager.createPlaywrightClientForWorker(workerId)
const tools = mcpManager.getToolsForWorker(workerId)
await mcpManager.destroyPlaywrightClientForWorker(workerId)
```

### Skills 技能系统

**懒加载**：Agent 启动时仅有 `load_skills` + 基础工具，调用后动态注入对应 MCP 工具。

旧 Skill 商城、`/v1/user/skills` 远端同步、本地安装管理 API 和 `/api/skills/templates/*` 路由已经移除。`SkillEntry` 只公开 SKILL.md frontmatter 的 `name`、`description` 与可选 canonical `ref`。`load_skill_file` 要求 `name` / `ref` 二选一：`name` 只在本地列表中精确匹配，不搜索模板库；`ref: official:<id> | user:<id>` 通过 `templateService.ts` 获取模板详情、确保安装后读取。

动态 Skill system prompt 先用简短 Markdown list 说明 `name`、`description`、`ref` 字段，再以 `<available-skills>` XML 列出每个 entry 的对应值；其中 frontmatter 文本必须经过 XML 实体转义。prompt 不重复解释 Skill、工具调用和分页规则。

本地列表继续扫描三类目录：

- `library/skills/builtin`：随 Agent 下发的只读内置 Skill
- `library/skills/user`：用户自建、手工放置或历史版本导入的 Skill
- `library/skills/installed`：官方或用户自建 Skill 类型模板的统一安装目录；同时继续作为本地 Skill 来源读取

内置技能：

- `openapiMcpSkills`：RoxyBrowser 配置文件/浏览器管理
- `playwrightMcpSkills`：浏览器自动化（导航、点击、截图等）

### Sandbox 脚本执行（`modes/sandbox.ts` + `@roxy/sandbox`）

用户自动化脚本在隔离的 `node:vm` 中运行，宿主经 `sandboxApis`（`modes/sandbox.ts`）向脚本注入能力：

- Node 内置镜像：`path` / `url` / `crypto` / `buffer` / `stream`（含 `node:` 前缀）
- `playwright`：`{ chromium, firefox }`（来自 `@roxybrowser/playwright`）
- **能力模块**：脚本以 `@roxybrowser/sandbox/*` specifier 导入，值取自 workspace 包 **`@roxy/sandbox/*`**（`packages/roxy-sandbox`，依赖 `workspace:*`，见其 `CLAUDE.md`）——`utils` / `human` / `2fa` / `llm` / `table` / `kv` / `debug` / `download` 子路径。注入前宿主完成装配：`table`/`kv` 的 `__setStorageDir`、`download` 的 `__setOutputDir`、`llm` 的 `__setLlmTransport`（`core/sandbox/llmTransport.ts`）、`debug` 的 `__configureDebug`，并用 `publicExports()` 剔除 `__` 前缀的宿主专用导出。

`services/sandboxService.ts` 负责：fork/占用 sandbox 子进程（`occupiedDirIds`）、为 `dirId` 打开或复用 RoxyBrowser 窗口（`openBrowserForDirId` 推断 chromium/firefox 内核）、产物收集（IPC 上报 + `collectArtifacts` 递归扫描兜底）、`AbortSignal`→`SIGTERM`、退出码映射（0=done / 124=timeout / SIGKILL=killed / 其他=failed）。脚本入口契约为 `main(options): Promise<string | void>`，字符串返回值经 IPC 写入 `SandboxRunResult.returnValue`；其中 `LoginRequired` 会被 Agent `run_script` 和 Script 任务执行器统一判为失败，提示目标窗口需要登录后重试。

### LLM 集成（`src/llm/index.ts`）

模型不在客户端配置，而是 `createLLM()` 运行时经 `agentModelApi.getUserModel()` 从 **roxy-agent-server 的 `/llm-proxy`** 拉取 `UserModelInfo`。Agent 只读取 `text_model`（含 `model` + `api_format`）；生图、VLM 和视频模型已不属于本包运行时。**所有 LLM 流量都走 `/llm-proxy`**：`baseURL = aiAgentUrl`（`${ROXY_SERVER_URL}/llm-proxy`）、`apiKey = aiAgentToken`（`${ROXY_API_KEY}:${ROXY_USER_TOKEN}`）。

`src/api/agentApiClient.ts` 承载模型配置、模板、任务、文件等非 LLM 后端请求，并统一注入 `Authorization: Bearer ${ROXY_API_KEY}:${ROXY_USER_TOKEN}`、`WorkspaceID: ${ROXY_WORKSPACE_ID}`、`Language` 和 `ai-agent-version`。`ROXY_WORKSPACE_ID` 缺失或为空时请求直接失败。LangChain provider 发起的 LLM 转发请求暂不携带 `WorkspaceID`，只保留既有 tracing headers。

`createLLMFromModelInfo()` 按 `api_format` 建 LangChain 实例：

| api_format  | LangChain 类    | 备注                                                                                                                                       |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `anthropic` | `ChatAnthropic` | **当前主用**：用户主要用 DeepSeek 官方 Anthropic 兼容 API（`anthropicApiUrl` 指向 `/llm-proxy`）；`enableThinking` 时 `budget_tokens=4096` |
| `openai`    | `ChatOpenAI`    | `modelKwargs.enable_thinking` 透传  |
| `google`    | `ChatGoogle`    | 使用 `/llm-proxy` endpoint 和统一 tracing headers |


> 团队已决定统一走 Anthropic API 协议；后续可能接入其他模型/上游，目前暂未扩展。provider/model/apiKey 全部由后端下发。

### HTTP 服务器路由（`src/routes/`）

路由层在 `src/app.ts` 统一注册，业务逻辑在 `src/services/` 中。

```
POST   /api/conversations/create
GET    /api/conversations/list
GET    /api/conversations/detail?conversationId=...
POST   /api/conversations/update
POST   /api/conversations/delete
POST   /api/upload            # 上传附件
GET    /api/files/:fileId

GET    /api/mcp/servers       # 列出 MCP 服务
POST   /api/mcp/servers       # 新增/更新
DELETE /api/mcp/servers/:name
POST   /api/mcp/servers/:name/enable
POST   /api/mcp/servers/:name/disable
POST   /api/mcp/servers/:name/test
POST   /api/mcp/servers/import  # 从 Claude Desktop 格式批量导入

POST   /api/scripts/self-description

GET    /api/tasks/logs/:logId/replay
POST   /api/tasks/logs/:logId/stop
DELETE /api/tasks/logs/:logId
POST   /api/tasks/:taskId/run # 立即执行
POST   /api/tasks/sync        # 从后端同步并重注册 timer

POST   /api/roxy-claw/start|stop
POST   /api/roxy-claw/test/{telegram,lark,slack,discord}
GET    /api/roxy-claw/weixin/qrcode
GET    /api/roxy-claw/weixin/qrcode-status

WS     /api/events             # 双向会话、任务日志与 task-monitor 统一事件信道
```

五条 conversation action path 是 Agent Console 与 `roxy-agent-app` 共用的当前协议，只使用 GET/POST 并返回 camelCase DTO。旧 MCP 页面使用的 RESTful conversation、Skill 管理和模型选择 HTTP API 已无消费者并删除；模型配置由 Agent 运行时直接从 `/llm-proxy` 获取。

**WebSocket 事件信道**：双方 envelope 均为 `{ id, type, data }`，完整协议按发送方和消息类型拆分在 `@roxy/shared/channel`，Zod schema 是运行时校验和 TypeScript 类型的唯一来源；Agent 校验入站命令和出站消息，Web 校验出站命令和入站消息。服务端消息 `id` 使用 UUIDv7。连接后先发送完整 `task_logs.snapshot` 和 `task_monitor.snapshot`，再发送 `channel.ready`；运行期广播 `task_log.changed`、`task_log.deleted`、`task_execution.event`、`task_monitor.snapshot` 和 `conversation.run.event`。服务端使用 ping/pong 保活，前端断线后指数退避重连并以快照/会话详情校准；不再提供独立 `/health`、会话日志读取 HTTP 或 conversation SSE。

前端入站命令只有三类：

- `conversation.run.start`：`{ conversationId, message, attachments?, fullAccess? }`
- `conversation.run.stop`：`{ conversationId }`
- `conversation.approval.submit`：`{ conversationId, approvalId, decisions }`

同一会话仍在执行时，新 `conversation.run.start` 会被静默丢弃。前端也继续在轮次未完成时禁用发送。Agent 会话统一通过 `conversation.run.event` 下行，其 `data` 包含 `conversationId`、`runId`、`turnId`、`assistantMessageId`、连续递增的 `sequence`、`timestamp` 和显式 `event`。每轮顺序固定为 `run_started` → `user_message` → 流式事件 → `run_completed | run_failed | run_cancelled`；流式事件包括 `title_changed`、`todo_delta`、thinking/content/tool/worker/retry/approval/script/artifact/token 等 canonical 类型。thinking/content 碎片继续逐条广播并以原实时 sequence 保存在活动 run 内存中，完成边界到达后才合并成单条连续序号记录写入该轮 JSONL；新 WebSocket 客户端会在 ready 前补收活动 run 的内存事件。网络重试用 `run_retrying` 回滚失败 attempt 的未完成片段，用户手动停止则把当前未完成片段作为完整内容落盘。多 worker 事件携带 `workerId`，聚合与回滚也按 worker 隔离。

会话内脚本日志使用 shared `script_output` 事件，定时/手动脚本任务日志使用 shared `task_execution.event` 中的 `script.window.*` 与 `script.log.*` 事件，全部通过启动时建立的同一个 `/api/events` WebSocket 下发。旧的独立 `/api/scripts/run*` 运行链路已无消费者并删除；脚本只通过 Agent `run_script` 工具或 Script 任务执行器运行。模型供应商的上游流式响应由 Agent 内部转换为 canonical WebSocket 事件；用户 MCP 也只支持 stdio 和 streamable HTTP，不再提供在线 SSE transport。

### 中断处理

`AbortRegistry`（`src/core/registry/abortRegistry.ts`）管理每个 run 的 `AbortController`：

```typescript
abortRegistry.createAbort(runId)
abortRegistry.abortRun(runId)
abortRegistry.cleanupRun(runId)
```

Agent 内部在每次工具调用前检查 `config.signal?.aborted`，抛出 `AbortError`。

## 数据存储

> **存储结构（2026-07 起）**：所有数据统一锚定在 `~/.roxy-agent`（生产）或 `~/.roxy-agent-dev`（开发/测试），路径一律通过 `src/core/storage/agentPaths.ts` 的本地 `agentPaths` 取得；该模块用 `@roxy/shared/agent-paths` 的 `createAgentPaths()` 创建单例，禁止在 agent 包内直接引用 shared 的单例。整体设计见 `docs/agent-data-directory-design.md`。启动时 `src/core/storage/bootstrap.ts` 触发一次性迁移器 `src/core/storage/migrate.ts`（幂等，`.version` 守卫）把旧布局归位到新结构。

SQLite 数据库：

**`state/legacy/conversations.db`**（deepagents 消息正文库，runtime 落地后随引擎退役清理）：

- `conversations`：对话元数据（id、user_id、workspace_id、title、thread_id、workspace_path、model、is_active、is_title_set）
- `messages`：消息记录（支持 inline 和 file 两种存储方式）
- `files`：上传附件和 Agent 产物的本地/OSS 元数据与 hash

启动时会从旧库删除 `conversation_type`、`agent_mode` 以及生图专用 `assets` / `assets_fts`；新库不再创建这些字段和表。`state/legacy/checkpoint.db` 只可能作为旧布局迁移产物存在，当前会话 checkpoint 使用下面的 per-session 数据库。

**`state/tasks/tasks.db`**：

- `task_logs`：当前设备任务执行日志；任务定义仍以后端 MySQL 为事实源

其余落点（均由 `agentPaths` 提供）：

- LangGraph 每对话独立 checkpoint：`sessions/{yyyy}/{mm}/{conversationId}/checkpoint.db`（经 `deepagents/checkpointPaths.ts`；兼容期旧会话仍可能位于 `sessions/{conversationId}/`）
- 会话浏览器操作记录：`sessions/{conversationId}/recording.jsonl`
- 会话每轮 canonical 事件：`sessions/{conversationId}/turns/{assistantMessageId}.jsonl`；启动迁移 schema v2 会在旧目录搬迁完成后把历史 `.sse` 统一转换为该格式，成功后才写 `.version=2`
- MCP 配置：`state/mcp/servers.json` + `state.json`
- 脚本库：`library/scripts/{slug}.ts`；权限门禁：`library/scripts/{slug}.permissions.json`
- 脚本工作区：`workdir/{slug}/`（sandbox 的 `process.cwd()` / `SANDBOX_OUTPUT_DIR` 指向此处；table/kv 等长期保存）
- 脚本浏览器输出：`workdir/{slug}/browser/{yyyy-mm-dd}/`；运行日志：`workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log`
- 进程日志：`logs/agent/{yyyy-mm-dd}.log`、`logs/worker/{yyyy-mm-dd}/{pid}.log`；IM 已并入 agent，sandbox 日志归脚本 workdir
- 会话浏览器输出：`sessions/{conversationId}/browser/{screenshots,downloads,traces,snapshots}`，随会话目录一起删除
- 上传附件：`sessions/_orphaned/uploads/`（暂未按会话归属）
- 历史 SSE 迁移暂存：`cache/sse`；转换完成后不再承载运行时会话；IM 线程映射：`state/im/threads.json`
- 技能：`library/skills/{user,installed,builtin}`，其中 `installed` 专供 Skill 类型模板安装，不得作为旧商城缓存删除
- 注：`sessions/` 查询已有会话时应优先使用 `index.db.rel_path`；兼容期无 `createdAt` 的调用仍可能落在扁平 `sessions/{id}`。

## 环境变量

### 必需

```bash
CHECKPOINT_DIR=./logs
ROXY_SERVER_PORT=3000
ROXY_SERVER_URL=...    # 后端根地址，拼出 /llm-proxy（LLM 流量与模型信息都走它）
ROXY_API_KEY=...       # 与 ROXY_USER_TOKEN 冒号拼成 aiAgentToken 鉴权
ROXY_USER_TOKEN=...
```

### Agent 行为

```bash
SYSTEM_LANGUAGE=zh-CN
```

### MCP

```bash
ROXY_API_KEY=...
ROXY_API_HOST=...
```

### 其他

```bash
ROXY_MODE=agent               # agent | worker | sandbox
ROXY_USER_ID=...
ROXY_WORKSPACE_ID=...
ROXY_USER_TOKEN=...           # 当前账号 token（用于鉴权）
ROXY_SERVER_URL=...           # AI Agent 代理 URL（构造 aiAgentUrl/aiAgentToken）
ROXY_SERVER_HEADERS={}        # 注入到 HTTP 请求头的额外 headers（JSON）
SKILLS_DIR=...
DOWNLOADS_DIR=...
DESKTOP_DIR=...               # 系统桌面目录（sandbox 可访问）
AGENT_WORK_DIR=...            # Agent 工作目录
AGENT_SCRIPT_PATH=...         # 脚本运行时路径
AGENT_ENTRY_SCRIPT=...        # Worker 模式入口脚本路径
ENV_TYPE=development          # development | production（替代 NODE_ENV）
AI_AGENT_VERSION_DEV=...      # 开发环境 agent 版本号
AI_AGENT_VERSION_PROD=...     # 生产环境 agent 版本号
DEBUG=true
```
