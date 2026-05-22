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
  env,        // 所有环境变量由 Electron 主进程注入，agent 本身不读取 .env 文件
  execArgv: isDev ? ['--inspect=20580', '--experimental-network-inspection'] : [],
  stdio: 'pipe',
})
```

**环境变量由 Electron 注入**，具体值来源：
- `LLM_PROVIDER/MODEL/API_KEY`：从后端 `userGetLlmInfoList` 接口获取
- `ROXY_API_KEY/HOST`：`store.apiKey` 和本地 API 端口（`http://127.0.0.1:{apiPort}`）
- `ROXY_SERVER_PORT`：动态分配的端口
- `ROXY_USER_ID/WORKSPACE_ID`：来自 `store`
- `CHECKPOINT_DIR`：`agentUpdater.agentDir + '/checkpoints'`
- `SKILLS_DIR`：`agentUpdater.agentDir`
- `DOWNLOADS_DIR`：`app.getPath('downloads')`（系统下载目录）
- `ROXY_MODE`：IM 启用时为 `'im'`，否则为 `'agent'`（两者互斥，只启动一个进程）

**子进程与主进程通信**（`worker.on('message', ...)`）：
- `save_chat_message`：保存对话消息到后端 + 阿里云 OSS

**脚本路径**：
- 开发环境：`apps/electron/src/modules/mcp/` 下的 `agent.mjs` / `openapiMcp.mjs` / `playwrightMcp.mjs`
- 生产环境：`appConfig.agentBinPath` / `openapiMcpBinPath` / `playwrightMcpBinPath`（从 OSS 下载后的本地路径）

> 本地开发调试时（`tsx src/cli.ts`）才会读取 `.env` 文件。生产/打包环境下所有配置均由 Electron 主进程注入。

## 构建命令

```bash
vite build          # 构建到 dist-vite/（ES 模块，Node 22 SSR）
pnpm bundle         # Webpack 打包到 dist/（发布用）
pnpm build          # 完整构建：vite build + build-words + bundle
tsx src/cli.ts      # 开发环境启动（读取 .env 文件）
node scripts/run-dist.mjs  # 运行编译产物
```

## 目录结构

```
src/
├── index.ts              # 应用入口，解析执行模式
├── config.ts             # 环境变量读取与默认值
├── logger.ts             # 文件日志（按日期轮转，5MB/7天）
├── abortRegistry.ts      # AbortController 生命周期管理
├── mcpManager.ts         # MCP 客户端管理（OpenAPI + Playwright + 用户自定义）
├── sensitiveWords.ts     # 敏感词过滤
├── cli.ts                # CLI 入口（转发到 index.ts）
├── llm/                  # LLM 集成层
│   ├── index.ts          # LLM 工厂函数 createLLM()
│   ├── provider.ts       # Provider 枚举
│   └── model/            # 各模型实现
│       ├── baseLLMChart.ts
│       ├── claude.ts     # Anthropic（anthropicApiUrl 替代 baseURL）
│       ├── deepseek.ts   # DeepSeek（支持 enable_thinking）
│       ├── qwen.ts       # 阿里通义千问
│       ├── chatgpt.ts    # OpenAI GPT
│       ├── gemini.ts     # Google Gemini
│       ├── kimi.ts       # Kimi
│       ├── moonshot.ts   # Moonshot
│       └── siliconflow-deepseek.ts
├── deepagents/           # Agent 执行引擎（核心）
│   ├── index.ts          # Agent 工厂 createAgent()
│   ├── handle-stream.ts  # 流式事件处理
│   ├── tool-wrapper.ts   # 工具异常包装（错误计数限制）
│   ├── sqlite-checkpointer.ts  # LangGraph checkpoint 持久化
│   ├── sqlite-store.ts   # SQLite 状态存储
│   ├── prompt/index.ts   # 系统提示词
│   └── tools/index.ts    # parallel_dispatch 工具
├── database/
│   ├── conversations/    # 对话与消息 SQLite 存储
│   │   ├── index.ts      # ChatContextAPI
│   │   └── types.ts
│   └── context/index.ts  # 跨轮次上下文（摘要 + allowedSkills）
├── server/               # Express HTTP 服务器
│   ├── index.ts          # 服务器初始化
│   ├── chatRoutes.ts     # /api/chat/*
│   ├── mcpRoutes.ts      # /api/mcp/*
│   ├── skillRoutes.ts    # /api/skills/*
│   ├── streamAdapter.ts  # Agent 事件 → SSE 格式转换
│   └── sseLogger.ts
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
│   └── telegram/
└── modes/
    ├── agent.ts          # HTTP 服务模式
    ├── im.ts             # IM 服务模式
    └── worker.ts         # Worker 模式（未实现）
```

## 核心架构

### 执行模式

应用通过 `ROXY_MODE` 或 CLI 参数选择三种模式：

- **`agent`**（默认）：启动 Express HTTP 服务器，接收前端请求
- **`im`**：启动 IM 适配器（飞书/Telegram/Slack/Discord），作为后台服务运行
- **`worker`**：占位符，未实现

### Agent 双模式（`src/deepagents/`）

执行模式由**前端调用接口时传入**，而非由服务端配置决定。

**Simple 模式**：单 Agent 迭代工具调用。

**Orchestrator 模式**：多 worker 模式。适合浏览器多窗口并行执行


### MCP 集成（`src/mcpManager.ts`）

三类 MCP 客户端：

| 类型 | 范围 | 传输方式 |
|------|------|----------|
| OpenAPI MCP（`roxybrowser_openapi`）| 全局共享 | InMemoryTransport |
| Playwright MCP（`roxybrowser_playwright_{workerId}`）| 每 Worker 隔离 | stdio 子进程 |
| 用户自定义 MCP | 全局可配置 | stdio / http（不支持sse模式） |

生命周期：
```typescript
await mcpManager.createPlaywrightClientForWorker(workerId)
const tools = mcpManager.getToolsForWorker(workerId)
await mcpManager.destroyPlaywrightClientForWorker(workerId)
```

### Skills 技能系统

**懒加载**：Agent 启动时仅有 `load_skills` + 基础工具，调用后动态注入对应 MCP 工具。

内置技能：
- `openapiMcpSkills`：RoxyBrowser 配置文件/浏览器管理
- `playwrightMcpSkills`：浏览器自动化（导航、点击、截图等）

### 多 LLM 支持

`createLLM(enableThinking?)` 根据 `LLM_PROVIDER` + `LLM_MODEL` 创建实例：

| Provider | 备注 |
|----------|------|
| `siliconflow` | 默认，支持 DeepSeek thinking |
| `dashscope` | 阿里云通义千问 |
| `openrouter` | 多模型聚合 |
| `roxybrowser` | RoxyBrowser 代理 API |
| `custom` | 自定义 base URL |

Thinking 模式：`enableThinking=true` 时，DeepSeek/Qwen 在 `chunk.additional_kwargs.reasoning` 返回推理过程。

### 上下文管理（`src/database/context/`）

- 消息数超过 `MAX_MESSAGES_BEFORE_SUMMARY` 时自动压缩
- 压缩：保留最近 `KEEP_RECENT_MESSAGES` 条 + 摘要消息
- 记录 `input_tokens`/`output_tokens`，用于用量统计

### HTTP 服务器路由（`src/server/`）

```
POST   /api/chat              # 流式聊天（SSE）
POST   /api/conversations     # 创建对话
GET    /api/conversations     # 列出对话
GET    /api/conversations/:id
PUT    /api/conversations/:id
DELETE /api/conversations/:id
POST   /api/upload            # 上传附件
GET    /api/files/:fileId

GET    /api/mcp/servers       # 列出 MCP 服务
POST   /api/mcp/servers       # 新增/更新
DELETE /api/mcp/servers/:name
POST   /api/mcp/servers/:name/enable
POST   /api/mcp/servers/:name/disable
POST   /api/mcp/servers/:name/test
POST   /api/mcp/servers/import  # 从 Claude Desktop 格式批量导入

GET    /api/skills            # 列出已安装技能
POST   /api/skills/validate
POST   /api/skills/install
DELETE /api/skills/:name

GET    /health
```

**SSE 事件类型**：`session` `content` `thinking` `planning` `worker_content` `worker_thinking` `worker_result` `synthesis` `tool_call` `tool_result` `token_usage` `error` `done` `interrupt` `todo` `title`

### 中断处理

`AbortRegistry`（`src/abortRegistry.ts`）管理每个 run 的 `AbortController`：
```typescript
abortRegistry.createAbort(runId)
abortRegistry.abortRun(runId)
abortRegistry.cleanupRun(runId)
```

Agent 内部在每次工具调用前检查 `config.signal?.aborted`，抛出 `AbortError`。

## 数据存储

两个 SQLite 数据库（均在 `CHECKPOINT_DIR`）：

**`conversations.db`**：
- `conversations`：对话元数据（id、user_id、workspace_id、title、thread_id、model、status）
- `messages`：消息记录（支持 inline 和 file 两种存储方式）

**`checkpoint.db`**：
- `conversation_contexts`：上下文快照（messages、allowed_skills、token 用量）

LangGraph checkpoint 文件：`checkpoint_{conversationId}.db`（每个对话独立）

## 环境变量

### 必需

```bash
LLM_PROVIDER=siliconflow
LLM_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_API_KEY=sk-...
CHECKPOINT_DIR=./logs
ROXY_SERVER_PORT=3000
```

### Agent 行为

```bash
MAX_TURNS=20                      # 最大工具调用轮次
CONTEXT_MESSAGE_LIMIT=15          # 最大对话历史条数
WORKER_CONTEXT_LIMIT=6            # 最大并行 Worker 数（0 = 禁用 orchestrator）
MAX_MESSAGES_BEFORE_SUMMARY=20    # 触发摘要阈值
KEEP_RECENT_MESSAGES=6            # 摘要后保留条数
SILICONFLOW_THINKING_BUDGET=4096  # Thinking token 预算
SYSTEM_LANGUAGE=zh-CN
```

### MCP

```bash
OPENAPI_SCRIPT_PATH=...
PLAYWRIGHT_SCRIPT_PATH=...
ROXY_API_KEY=...
ROXY_API_HOST=...
PLAYWRIGHT_MCP_SNAPSHOT_MODE=optimized
PLAYWRIGHT_MCP_ROXY_MODE=true
```

### IM（可选）

```bash
ENABLE_IM=true

TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=...

FEISHU_APP_ID=...
FEISHU_APP_SECRET=...
FEISHU_ALLOWED_USER_IDS=...

SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=...
SLACK_ALLOWED_USER_IDS=...
SLACK_ALLOWED_CHANNEL_IDS=...

DISCORD_BOT_TOKEN=...
DISCORD_ALLOWED_USER_IDS=...
DISCORD_ALLOWED_CHANNEL_IDS=...
DISCORD_ALLOWED_GUILD_IDS=...
```

### 其他

```bash
ROXY_MODE=agent           # agent | im | worker
ROXY_USER_ID=...
ROXY_WORKSPACE_ID=...
SKILLS_DIR=...
DOWNLOADS_DIR=...
DEBUG=true
DEVELOPMENT=true
```
