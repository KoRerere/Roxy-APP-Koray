---
title: roxy-agent 会话上下文压缩功能设计
created: 2026-05-29
status: draft
---

# 会话上下文压缩功能设计方案

## Context（背景）

### 问题描述

roxy-agent 是一个基于 LangGraph 和 deepagents (v1.9.0) 的 AI agent 系统，当前缺少自动化的上下文压缩机制。随着对话轮次增加，上下文窗口会逐渐填满，可能导致：

1. **超出模型上下文限制**：不同模型有不同的 token 限制（如 Claude Opus 4.7 为 200K tokens）
2. **性能下降**：研究表明，当上下文使用率超过 75% 时，模型推理质量会显著下降
3. **成本增加**：每次请求都携带完整历史，导致 token 消耗线性增长
4. **用户体验差**：长对话可能出现"遗忘"早期指令或偏离任务目标的情况

### 当前实现分析

**现有配置：**
- `CONTEXT_MESSAGE_LIMIT=15`：配置项存在但未被实际使用
- `WORKER_CONTEXT_LIMIT=6`：orchestrator 模式下的 worker 数量限制
- 无自动触发的上下文管理机制

**消息存储：**
- SQLite 数据库存储对话历史（`conversations.db`）
- LangGraph checkpoint 机制（每个对话独立的 `checkpoint_{conversationId}.db`）
- SSE 流式输出文件（`.sse` 文件）

**当前流程：**
```
用户消息 → ChatContextAPI.addMessage() → LangGraph agent.stream() → 
checkpoint 自动保存 → 返回响应
```

### 行业最佳实践

通过 Tavily 搜索和研究，主流方案包括：

**1. Claude Code 的三层压缩策略：**
- **Microcompaction**：及早卸载大体积工具结果到磁盘
- **Auto-compaction**：在上下文使用率达到 75% 时触发（保留 25% 作为推理空间）
- **Manual compaction**：用户手动触发 `/compact` 命令
- **Rehydration**：压缩后重新读取最近 5 个文件 + 恢复 todo 状态

**2. LangGraph 官方方案：**
- `trimMessages`：保留最近 N 条消息
- `RemoveMessage`：删除特定消息
- `SummarizationNode`：使用 LLM 生成摘要
- `pre_model_hook` / `post_model_hook`：在模型调用前后插入逻辑

**3. deepagents (v1.9.0) 内置机制：**
- 在上下文达到 85% 时触发压缩（默认阈值）
- 截断旧的大型工具调用（file write/edit）
- 摘要旧消息，保留最近消息

## 设计方案

### 核心目标

1. **自动触发**：在上下文大小达到阈值时自动压缩
2. **准确估算**：能够准确计算当前上下文大小，包括 system prompt、tools、skills、历史消息
3. **LLM 驱动**：使用 LLM 生成高质量摘要，保留关键信息
4. **无缝集成**：与现有 deepagents + LangGraph 架构兼容
5. **可配置**：支持通过环境变量调整压缩策略

### 架构设计

#### 1. Token 计数模块 (`src/deepagents/tokenCounter.ts`)

**职责：**
- 估算消息、system prompt、tools 的 token 数量
- 提供统一的 token 计数接口

**实现：**
```typescript
import { encodingForModel } from 'js-tiktoken'

interface TokenCountResult {
  systemPrompt: number
  tools: number
  messages: number
  total: number
  percentage: number  // 相对于模型最大上下文的百分比
}

export class TokenCounter {
  private encoder: Tiktoken
  private maxContextTokens: number
  
  constructor(modelName: string) {
    // 根据模型名称初始化 encoder 和 maxContextTokens
    this.encoder = encodingForModel(modelName)
    this.maxContextTokens = this.getMaxTokensForModel(modelName)
  }
  
  countTokens(text: string): number {
    return this.encoder.encode(text).length
  }
  
  estimateContextSize(
    systemPrompt: string,
    tools: StructuredTool[],
    messages: BaseMessage[]
  ): TokenCountResult {
    // 实现详细的 token 计数逻辑
  }
  
  private getMaxTokensForModel(modelName: string): number {
    // Claude Opus 4.7/4.6: 200K
    // Claude Sonnet 4.6: 200K
    // DeepSeek V3: 64K
    // 等等
  }
}
```

**关键点：**
- 使用 `js-tiktoken` 库进行 token 计数（支持多种模型）
- 预留 20-25% 的空间作为"完成缓冲区"（completion buffer）
- 考虑 system prompt 动态注入（skills middleware）

#### 2. 上下文压缩中间件 (`src/deepagents/compressionMiddleware.ts`)

**职责：**
- 在每次模型调用前检查上下文大小
- 触发压缩流程
- 管理压缩策略

**实现：**
```typescript
import { createMiddleware } from 'langchain'
import { TokenCounter } from './tokenCounter'

interface CompressionConfig {
  triggerThreshold: number      // 触发压缩的阈值（0.75 = 75%）
  keepRecentMessages: number     // 压缩后保留的最近消息数
  summaryMaxTokens: number       // 摘要的最大 token 数
  enabled: boolean               // 是否启用压缩
}

export function createCompressionMiddleware(config: CompressionConfig) {
  const tokenCounter = new TokenCounter(modelName)
  
  return createMiddleware({
    name: 'ContextCompressionMiddleware',
    
    wrapModelCall: async (request: any, handler: any) => {
      const { systemMessage, messages, tools } = request
      
      // 1. 估算当前上下文大小
      const contextSize = tokenCounter.estimateContextSize(
        systemMessage,
        tools,
        messages
      )
      
      // 2. 判断是否需要压缩
      if (contextSize.percentage >= config.triggerThreshold) {
        console.log(`[Compression] Triggered at ${contextSize.percentage}% usage`)
        
        // 3. 执行压缩
        const compressedMessages = await compressMessages(
          messages,
          config.keepRecentMessages,
          config.summaryMaxTokens
        )
        
        // 4. 替换消息列表
        return handler({
          ...request,
          messages: compressedMessages
        })
      }
      
      // 未达到阈值，正常处理
      return handler(request)
    }
  })
}

async function compressMessages(
  messages: BaseMessage[],
  keepRecent: number,
  summaryMaxTokens: number
): Promise<BaseMessage[]> {
  // 1. 分离最近消息和旧消息
  const recentMessages = messages.slice(-keepRecent)
  const oldMessages = messages.slice(0, -keepRecent)
  
  if (oldMessages.length === 0) {
    return messages  // 无需压缩
  }
  
  // 2. 使用 LLM 生成摘要
  const summary = await generateSummary(oldMessages, summaryMaxTokens)
  
  // 3. 构建压缩后的消息列表
  const summaryMessage = new SystemMessage({
    content: `[Previous conversation summary]\n${summary}\n[End of summary]`
  })
  
  return [summaryMessage, ...recentMessages]
}

async function generateSummary(
  messages: BaseMessage[],
  maxTokens: number
): Promise<string> {
  const llm = await createLLM(false)  // 不启用 thinking
  
  const summaryPrompt = env.SYSTEM_LANGUAGE === 'zh-CN'
    ? `请总结以下对话历史，保留关键信息：
- 用户的主要目标和意图
- 已完成的操作和结果
- 重要的决策和约束条件
- 待办事项和下一步计划
- 遇到的错误和解决方案

对话历史：
${formatMessagesForSummary(messages)}

请用简洁的语言总结，不超过 ${maxTokens} tokens。`
    : `Summarize the following conversation history, preserving key information:
- User's main goals and intent
- Completed operations and results
- Important decisions and constraints
- Todo items and next steps
- Errors encountered and solutions

Conversation history:
${formatMessagesForSummary(messages)}

Provide a concise summary, no more than ${maxTokens} tokens.`
  
  const response = await llm.llm.invoke([
    new HumanMessage(summaryPrompt)
  ])
  
  return response.content as string
}
```

#### 3. 配置管理 (`src/config.ts`)

**新增环境变量：**
```typescript
export const env = {
  // ... 现有配置 ...
  
  // 上下文压缩配置
  COMPRESSION_ENABLED: process.env.COMPRESSION_ENABLED !== 'false',  // 默认启用
  COMPRESSION_TRIGGER_THRESHOLD: Number(process.env.COMPRESSION_TRIGGER_THRESHOLD) || 0.75,  // 75%
  COMPRESSION_KEEP_RECENT_MESSAGES: Number(process.env.COMPRESSION_KEEP_RECENT_MESSAGES) || 6,
  COMPRESSION_SUMMARY_MAX_TOKENS: Number(process.env.COMPRESSION_SUMMARY_MAX_TOKENS) || 2000,
}
```

#### 4. 集成到 Agent 创建流程

**修改 `src/deepagents/agent/chat.ts`：**
```typescript
import { createCompressionMiddleware } from '../compressionMiddleware'

export async function createChatAgent(options: {
  mode: 'simple' | 'orchestrator'
  workerId?: string
  conversationId?: string
}): Promise<AgentInstance> {
  // ... 现有代码 ...
  
  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
  })
  
  // 创建压缩中间件
  const compressionMiddleware = createCompressionMiddleware({
    triggerThreshold: env.COMPRESSION_TRIGGER_THRESHOLD,
    keepRecentMessages: env.COMPRESSION_KEEP_RECENT_MESSAGES,
    summaryMaxTokens: env.COMPRESSION_SUMMARY_MAX_TOKENS,
    enabled: env.COMPRESSION_ENABLED,
  })
  
  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt,
    tools,
    middleware: [
      ...runtime.middleware,
      compressionMiddleware,  // 添加压缩中间件
    ],
    // ... 其他配置 ...
  })
  
  // ... 返回 ...
}
```

### Token 计数实现细节

#### 预留空间计算

```typescript
interface ContextBudget {
  maxTokens: number           // 模型最大上下文
  reservedForCompletion: number  // 预留给响应的空间（20-25%）
  availableForInput: number   // 可用于输入的空间
  systemPromptTokens: number  // system prompt 占用
  toolsTokens: number         // tools 定义占用
  skillsTokens: number        // skills 注入占用
  messagesTokens: number      // 历史消息占用
  usedTokens: number          // 总已使用
  remainingTokens: number     // 剩余可用
  usagePercentage: number     // 使用率
}

function calculateContextBudget(
  modelName: string,
  systemPrompt: string,
  tools: StructuredTool[],
  messages: BaseMessage[]
): ContextBudget {
  const maxTokens = getMaxTokensForModel(modelName)
  const reservedForCompletion = Math.floor(maxTokens * 0.25)  // 25%
  const availableForInput = maxTokens - reservedForCompletion
  
  const systemPromptTokens = countTokens(systemPrompt)
  const toolsTokens = estimateToolsTokens(tools)
  const skillsTokens = estimateSkillsTokens()  // 从 middleware 缓存读取
  const messagesTokens = messages.reduce((sum, msg) => 
    sum + countTokens(formatMessage(msg)), 0
  )
  
  const usedTokens = systemPromptTokens + toolsTokens + skillsTokens + messagesTokens
  const remainingTokens = availableForInput - usedTokens
  const usagePercentage = usedTokens / availableForInput
  
  return {
    maxTokens,
    reservedForCompletion,
    availableForInput,
    systemPromptTokens,
    toolsTokens,
    skillsTokens,
    messagesTokens,
    usedTokens,
    remainingTokens,
    usagePercentage,
  }
}
```

#### Tools Token 估算

```typescript
function estimateToolsTokens(tools: StructuredTool[]): number {
  // 工具定义的 JSON schema 格式
  const toolsSchema = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.schema,
  }))
  
  return countTokens(JSON.stringify(toolsSchema))
}
```

#### Skills Token 估算

```typescript
// 在 skillTooling.ts 的 middleware 中缓存
let cachedSkillsTokens = 0

export function createRoxySkillsMiddleware() {
  let cachedPrompt = ''
  
  return createMiddleware({
    name: 'RoxySkillsMiddleware',
    beforeAgent: async () => {
      const skills = await listInstalledSkills()
      cachedPrompt = buildSkillsSystemPrompt(skills)
      cachedSkillsTokens = countTokens(cachedPrompt)  // 缓存 token 数
    },
    // ...
  })
}

export function getCachedSkillsTokens(): number {
  return cachedSkillsTokens
}
```

### 压缩策略

#### 1. 消息分类

```typescript
interface MessageClassification {
  critical: BaseMessage[]    // 必须保留（系统消息、最近消息）
  important: BaseMessage[]   // 重要但可压缩（工具调用结果、关键决策）
  compressible: BaseMessage[] // 可压缩（普通对话）
}

function classifyMessages(
  messages: BaseMessage[],
  keepRecent: number
): MessageClassification {
  const recentMessages = messages.slice(-keepRecent)
  const oldMessages = messages.slice(0, -keepRecent)
  
  const critical: BaseMessage[] = []
  const important: BaseMessage[] = []
  const compressible: BaseMessage[] = []
  
  for (const msg of oldMessages) {
    if (msg instanceof SystemMessage) {
      critical.push(msg)
    } else if (isToolMessage(msg) && isImportantTool(msg)) {
      important.push(msg)
    } else {
      compressible.push(msg)
    }
  }
  
  return {
    critical: [...critical, ...recentMessages],
    important,
    compressible,
  }
}

function isImportantTool(msg: ToolMessage): boolean {
  // 判断工具调用是否重要
  const importantTools = [
    'roxy_create_browsers',
    'roxy_open_browser',
    'write_todos',
    'parallel_dispatch',
  ]
  return importantTools.includes(msg.name || '')
}
```

#### 2. 分层摘要

```typescript
async function generateLayeredSummary(
  classification: MessageClassification,
  maxTokens: number
): Promise<string> {
  const sections: string[] = []
  
  // 1. 摘要可压缩消息
  if (classification.compressible.length > 0) {
    const conversationSummary = await summarizeConversation(
      classification.compressible,
      Math.floor(maxTokens * 0.6)
    )
    sections.push(`## Conversation Summary\n${conversationSummary}`)
  }
  
  // 2. 保留重要工具调用的简化版本
  if (classification.important.length > 0) {
    const toolSummary = summarizeToolCalls(classification.important)
    sections.push(`## Important Operations\n${toolSummary}`)
  }
  
  return sections.join('\n\n')
}

function summarizeToolCalls(messages: BaseMessage[]): string {
  // 不使用 LLM，直接提取关键信息
  return messages
    .filter(msg => msg instanceof ToolMessage)
    .map(msg => {
      const tool = msg as ToolMessage
      return `- ${tool.name}: ${truncate(tool.content, 100)}`
    })
    .join('\n')
}
```

### 监控和日志

#### 1. 压缩事件日志

```typescript
interface CompressionEvent {
  conversationId: string
  timestamp: number
  triggerReason: 'threshold' | 'manual'
  beforeTokens: number
  afterTokens: number
  compressionRatio: number
  messagesBeforeCount: number
  messagesAfterCount: number
  summaryTokens: number
}

function logCompressionEvent(event: CompressionEvent) {
  console.log(`[Compression Event]`, {
    conversationId: event.conversationId,
    ratio: `${(event.compressionRatio * 100).toFixed(1)}%`,
    tokens: `${event.beforeTokens} → ${event.afterTokens}`,
    messages: `${event.messagesBeforeCount} → ${event.messagesAfterCount}`,
  })
  
  // 可选：发送到监控系统
  // sendToMonitoring('compression_event', event)
}
```

#### 2. SSE 事件通知

```typescript
// 在 streamAdapter.ts 中添加新事件类型
export const streamAdapter = {
  // ... 现有方法 ...
  
  compression: (data: {
    beforeTokens: number
    afterTokens: number
    messagesRemoved: number
  }) => {
    return `data: ${JSON.stringify({
      type: 'compression',
      data,
    })}\n\n`
  },
}
```

## 关键文件清单

### 新增文件

1. **`packages/roxy-agent/src/deepagents/tokenCounter.ts`**
   - Token 计数核心逻辑
   - 模型上下文限制配置
   - 上下文预算计算

2. **`packages/roxy-agent/src/deepagents/compressionMiddleware.ts`**
   - 压缩中间件实现
   - 消息分类和摘要生成
   - 压缩策略管理

### 修改文件

1. **`packages/roxy-agent/src/config.ts`**
   - 添加压缩相关环境变量

2. **`packages/roxy-agent/src/deepagents/agent/chat.ts`**
   - 集成压缩中间件到 agent 创建流程

3. **`packages/roxy-agent/src/deepagents/skillTooling.ts`**
   - 缓存 skills token 数量
   - 导出 `getCachedSkillsTokens()` 方法

4. **`packages/roxy-agent/src/server/streamAdapter.ts`**
   - 添加 `compression` 事件类型

5. **`packages/roxy-agent/package.json`**
   - 添加依赖：`js-tiktoken`

## 实现步骤

### Phase 1: Token 计数基础设施

1. 安装 `js-tiktoken` 依赖
2. 实现 `TokenCounter` 类
3. 实现 `calculateContextBudget()` 函数
4. 添加单元测试验证 token 计数准确性

### Phase 2: 压缩中间件核心

1. 实现 `createCompressionMiddleware()`
2. 实现 `compressMessages()` 函数
3. 实现 `generateSummary()` 函数
4. 实现消息分类逻辑

### Phase 3: 集成到 Agent

1. 修改 `createChatAgent()` 集成中间件
2. 修改 `skillTooling.ts` 缓存 token 数
3. 添加配置项到 `config.ts`
4. 更新 `streamAdapter.ts` 添加事件

### Phase 4: 监控和优化

1. 添加压缩事件日志
2. 实现 SSE 通知
3. 添加性能监控指标
4. 编写集成测试

## 验证方法

### 1. 单元测试

```typescript
// tokenCounter.test.ts
describe('TokenCounter', () => {
  it('should count tokens accurately', () => {
    const counter = new TokenCounter('claude-opus-4-7')
    const text = 'Hello, world!'
    const tokens = counter.countTokens(text)
    expect(tokens).toBeGreaterThan(0)
  })
  
  it('should calculate context budget correctly', () => {
    const counter = new TokenCounter('claude-opus-4-7')
    const budget = counter.calculateContextBudget(
      systemPrompt,
      tools,
      messages
    )
    expect(budget.usagePercentage).toBeLessThan(1)
  })
})

// compressionMiddleware.test.ts
describe('CompressionMiddleware', () => {
  it('should trigger compression at threshold', async () => {
    // 模拟达到阈值的场景
  })
  
  it('should preserve recent messages', async () => {
    // 验证最近消息被保留
  })
  
  it('should generate meaningful summary', async () => {
    // 验证摘要质量
  })
})
```

### 2. 集成测试

```typescript
// 创建一个长对话，验证压缩触发
async function testLongConversation() {
  const conversationId = 'test_compression'
  
  // 发送多轮消息直到触发压缩
  for (let i = 0; i < 30; i++) {
    await sendMessage(conversationId, `Message ${i}`)
  }
  
  // 验证压缩事件被触发
  // 验证对话仍然连贯
}
```

### 3. 手动测试

1. 启动 agent 服务
2. 创建新对话
3. 发送大量消息（包含文件读写、工具调用等）
4. 观察日志中的压缩事件
5. 验证压缩后对话质量
6. 检查 SSE 流中的 compression 事件

### 4. 性能测试

```typescript
// 测试压缩对响应时间的影响
async function benchmarkCompression() {
  const withCompression = await measureResponseTime(
    conversationId,
    { compressionEnabled: true }
  )
  
  const withoutCompression = await measureResponseTime(
    conversationId,
    { compressionEnabled: false }
  )
  
  console.log('Compression overhead:', withCompression - withoutCompression)
}
```

## 配置示例

### 开发环境 (`.env.development`)

```bash
# 上下文压缩配置
COMPRESSION_ENABLED=true
COMPRESSION_TRIGGER_THRESHOLD=0.75  # 75% 触发
COMPRESSION_KEEP_RECENT_MESSAGES=6  # 保留最近 6 条
COMPRESSION_SUMMARY_MAX_TOKENS=2000 # 摘要最多 2000 tokens
```

### 生产环境

```bash
# 更保守的阈值，更早触发压缩
COMPRESSION_ENABLED=true
COMPRESSION_TRIGGER_THRESHOLD=0.70  # 70% 触发
COMPRESSION_KEEP_RECENT_MESSAGES=8  # 保留最近 8 条
COMPRESSION_SUMMARY_MAX_TOKENS=3000 # 摘要最多 3000 tokens
```

## 注意事项

### 1. deepagents 内置压缩

deepagents v1.9.0 已经内置了上下文压缩机制（默认 85% 触发）。我们的实现需要：
- **协调触发时机**：我们的中间件在 deepagents 之前触发（75% vs 85%）
- **避免重复压缩**：如果我们已经压缩，deepagents 的压缩可能不会再次触发
- **兼容性测试**：确保两者不会冲突

### 2. Checkpoint 持久化

压缩后的消息会被 LangGraph checkpoint 持久化，需要确保：
- 摘要消息正确序列化
- checkpoint 大小合理（避免过大）
- 可以从 checkpoint 恢复对话

### 3. IM 模式特殊处理

IM 模式（飞书/Telegram）有特殊的输出约束，压缩时需要：
- 使用更激进的压缩策略（更早触发）
- 摘要更简洁
- 考虑 IM 平台的消息长度限制

### 4. Orchestrator 模式

Orchestrator 模式下，每个 worker 有独立的上下文，需要：
- 为每个 worker 独立计算上下文
- worker 的上下文限制更小（`WORKER_CONTEXT_LIMIT=6`）
- orchestrator 本身也需要压缩

### 5. 性能考虑

- Token 计数是 CPU 密集型操作，需要缓存
- 摘要生成需要额外的 LLM 调用，增加延迟
- 考虑异步压缩（后台任务）vs 同步压缩（阻塞请求）

## 未来优化方向

### 1. 智能压缩策略

- 基于对话类型动态调整压缩策略
- 识别"关键转折点"，保留更多上下文
- 使用向量相似度保留相关消息

### 2. 增量摘要

- 不是每次都重新摘要全部历史
- 维护一个"滚动摘要"，每次只摘要新增部分
- 类似 Claude Code 的 delta summarization

### 3. 外部存储

- 将旧消息存储到外部系统（S3/OSS）
- 按需检索（RAG 方式）
- 减少 checkpoint 文件大小

### 4. 用户控制

- 提供 API 让用户手动触发压缩
- 允许用户配置压缩策略
- 提供"压缩预览"功能

### 5. 多模态压缩

- 图片附件的压缩策略
- PDF 文件的摘要
- 代码片段的智能保留

## 参考资料

- [Claude Code Context Window Management](https://www.damiangalarza.com/posts/2025-12-08-understanding-claude-code-context-window)
- [Inside Claude Code's Compaction System](https://decodeclaude.com/compaction-deep-dive)
- [LangGraph Memory Management](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [Context Engineering for Agents](https://www.langchain.com/blog/context-engineering-for-agents)
- [Deep Agents Context Management](https://www.langchain.com/blog/context-management-for-deepagents)
