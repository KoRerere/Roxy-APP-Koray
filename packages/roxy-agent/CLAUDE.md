# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在此代码库中工作的指导。

## 构建和开发命令

```bash
# 完整构建
pnpm build

# 仅 Vite 构建（生成 dist-vite/）
vite build

# Webpack 打包（生成 dist/）
pnpm bundle

# 开发环境启动服务器
tsx src/cli.ts
```

## 核心架构

### 双模式智能体系统

代码库实现了 **两种截然不同的智能体执行模式**：

1. **Simple 模式** (`src/agent/simple/`): 单智能体迭代式工具调用
2. **Orchestrator 模式** (`src/agent/orchestrator/`): 多智能体规划、并行执行、结果综合

**关键区别**：Simple 模式运行单个 LLM 循环调用工具，而 Orchestrator 模式遵循 **三阶段工作流**：

- **阶段 1 (Planning 规划)**: Orchestrator 生成 JSON 格式的任务计划
- **阶段 2 (Execution 执行)**: 并行 Worker 独立执行任务，每个 Worker 拥有隔离的 MCP 客户端
- **阶段 3 (Synthesis 综合)**: Orchestrator 综合所有 Worker 结果生成最终答案

### LangGraph 状态管理

两种模式都使用 **LangGraph 的 StateGraph**，但状态结构不同：

**Orchestrator 状态** (`src/agent/orchestrator/state.ts`):

- `messages`: 对话历史
- `plan`: 规划阶段生成的 `Subtask[]` 数组
- `worker_results`: 并行 Worker 返回的 `WorkerOutput[]` 数组
- `final_answer`: 综合后的最终答案
- `enableThinking`: 是否启用 LLM 深度思考模式
- `summary`: 压缩后的对话上下文

**路由逻辑** (`orchestrator.ts:routerOrchestrator`):

- 如果 `final_answer` 存在 → END
- 如果 `plan.length > 0 && worker_results.length < plan.length` → 使用 `Send()` API 派发并行 Worker
- 否则 → 继续到 orchestrator

### MCP (Model Context Protocol) 集成

**关键设计**：每个 Worker 获得 **隔离的 MCP 客户端** 以防止资源冲突。

**McpManager** (`src/mcpManager.ts`):

- 通过 `workerClients: Map<string, MultiServerMCPClient>` 管理每个 Worker 的 MCP 客户端
- 为每个 Worker 创建两个 MCP 服务器：
  1. **OpenAPI MCP** (`roxybrowser_openapi`): RoxyBrowser API 工具
  2. **Playwright MCP** (`roxybrowser_playwright_{workerId}`): 浏览器自动化工具

**生命周期**:

```typescript
// Worker 启动时
await mcpManager.createPlaywrightClient(workerId)
const tools = mcpManager.getToolsForWorker(workerId)

// Worker 完成时
await mcpManager.destroyWorkerClient(workerId)
```

**MCP 环境变量**:

- `OPENAPI_SCRIPT_PATH`: OpenAPI MCP 脚本路径
- `PLAYWRIGHT_SCRIPT_PATH`: Playwright MCP 脚本路径
- `ROXY_API_KEY`, `ROXY_API_HOST`: RoxyBrowser 凭证
- `PLAYWRIGHT_MCP_SNAPSHOT_MODE`: 设置为 `"optimized"`
- `PLAYWRIGHT_MCP_ROXY_MODE`: 设置为 `"true"`

### Skills 技能系统

**Skills 采用懒加载机制**，通过 `load_skills` 工具实现 (`src/agent/skills/index.ts`)。

**工作流程**:

1. Agent 启动时仅拥有 `load_skills` 工具 + 基础工具
2. Agent 调用 `load_skills` 并传入 `skillNames: string[]`
3. 系统返回技能内容并更新 `allowedTools` 数组
4. Agent 获得技能对应的 MCP 工具访问权限

**可用技能**:

- `openapiMcpSkills`: RoxyBrowser 配置文件/浏览器管理
- `playwrightMcpSkills`: 浏览器自动化（导航、点击、填写、截图）
- `fileSystemSkills`: 文件读写操作
- `twoFactorSkills`: 2FA 验证码生成

**实现细节**：技能列表存储在 `ContextManager` 的 `allowedSkills: string[]` 中，跨对话轮次自动恢复。

### 多 LLM 支持

**支持的提供商** (`src/llm/index.ts`):

- `siliconflow`: SiliconFlow API（默认）
- `dashscope`: 阿里云通义千问
- `openrouter`: OpenRouter
- `roxybrowser`: RoxyBrowser API
- `custom`: 自定义 base URL

**模型类** (`src/llm/model/`):

- `DeepSeek`: 支持 `enable_thinking` 参数
- `Qwen`: 阿里通义千问，支持思考模式
- `Claude`: Anthropic Claude（使用 `anthropicApiUrl` 而非 `baseURL`）
- `Gemini`: Google Gemini
- `ChatGPT`: OpenAI GPT 系列

**思考模式**：当 `enableThinking=true` 时，DeepSeek/Qwen 模型会在 `chunk.additional_kwargs.reasoning` 中返回推理过程。

### 上下文管理与记忆

**ContextManager** (`src/database/summary/`):

- 当 `messages.length > MAX_MESSAGES_BEFORE_SUMMARY` 时自动压缩对话
- 保留最近的 `KEEP_RECENT_MESSAGES` 条消息 + 摘要
- 存储 `allowedSkills` 以便跨对话恢复技能状态

**摘要流程**:

1. Agent 执行完成后触发 `ContextManager.updateContext(messages, threadId, allowedSkills)`
2. 如果消息数超过阈值，将旧消息压缩为摘要
3. 下一轮对话：`restoreHistoryContext()` 前置摘要 + 最近消息

### 服务器与流式传输

**Express 服务器** (`src/server/index.ts`):

- 端口：`ROXY_SERVER_PORT`（默认 3000）
- 路由：`/api/chat/*`（聊天 API）、`/health`（健康检查）
- 静态文件服务目录：`CHECKPOINT_DIR/static/`

**Stream Adapter** (`src/server/streamAdapter.ts`):

- 将智能体事件转换为 SSE 格式
- 事件类型：`content`、`thinking`、`toolCall`、`toolResult`、`planning`、`synthesis`、`workerContent`、`workerThinking`

**Writer 模式**：LangGraph config 包含 `writer?: (data: string) => void` 回调，用于向客户端流式传输数据块。

### 配置要求

**必需的环境变量**:

```bash
LLM_PROVIDER=siliconflow
LLM_MODEL=Pro/deepseek-ai/DeepSeek-V3.2
LLM_API_KEY=sk-...
MAX_TURNS=20                      # 最大工具调用循环次数
CONTEXT_MESSAGE_LIMIT=15          # 最大对话历史条数
WORKER_CONTEXT_LIMIT=6            # 最大并行 Worker 数（0=禁用）
CHECKPOINT_DIR=./logs             # 对话存储目录
ROXY_SERVER_PORT=3000
```

**可选配置**:

```bash
SILICONFLOW_THINKING_BUDGET=4096  # 思考 token 限制
MAX_MESSAGES_BEFORE_SUMMARY=6     # 触发摘要的消息数阈值
KEEP_RECENT_MESSAGES=6            # 摘要后保留的最近消息数
DEBUG=true                        # 启用调试日志
```

## 关键实现模式

### 并行 Worker 执行（Orchestrator 模式）

Worker 通过 **LangGraph 的 `Send()` API** 派发：

```typescript
// 在 routerOrchestrator() 中
return plan.map(task => new Send('worker', {
  task,
  workerId: task.workerId,
  enableThinking: state.enableThinking,
  sessionDir: state.sessionDir,
}))
```

每个 `Send()` 创建一个 **独立的 Worker 调用**，拥有隔离的 MCP 客户端。

### 非 Claude 模型的工具格式转换

Simple 模式对 Claude 模型直接使用 `StructuredTool` 对象。Orchestrator Worker 将工具转换为 OpenRouter 格式：

```typescript
function convertToolsToOpenRouterFormat(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema || {},
    },
  }))
}
```

### 中断处理

两种模式都支持通过 `config.signal` 取消执行：

```typescript
function checkAbort() {
  if (config.signal?.aborted) {
    throw new AbortError('User cancelled')
  }
}

// 在工具执行循环中
for (let turn = 0; turn < MAX_TURNS; turn++) {
  checkAbort()
  const stream = await llm.stream(messages, { signal: config.signal })
  // ...
}
```

### 任务计划 JSON 格式（Orchestrator）

规划阶段期望 LLM 返回：

```json
{
  "tasks": [
    {
      "id": "1",
      "description": "导航到 example.com"
    },
    {
      "id": "2",
      "description": "提取页面标题"
    }
  ]
}
```

任务数量限制为 `WORKER_CONTEXT_LIMIT`（设为 0 则禁用 orchestrator 模式）。

## Git 提交消息格式

**所有提交消息必须使用中文**（`.cursorrules` 要求）：

```
类型(范围): 简短描述

详细描述
```

类型：`feat`（新功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`test`（测试）、`chore`（构建）

## 调试

- 在 `.env` 中设置 `DEBUG=true` 启用调试日志
- Worker 执行日志包含工具调用表：`console.table(callTable)`
- 检查 `CHECKPOINT_DIR/` 目录查看对话历史和静态文件
- 通过 `mcpManager.count` 追踪 MCP 客户端数量

## Orchestrator vs Simple 模式选择

- **Simple 模式**：适用于单一任务、简单对话场景
- **Orchestrator 模式**：适用于需要任务分解、并行执行的复杂场景（需设置 `WORKER_CONTEXT_LIMIT > 0`）
