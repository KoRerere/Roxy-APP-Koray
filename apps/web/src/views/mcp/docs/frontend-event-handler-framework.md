# 前端 SSE 事件处理框架设计

## 当前问题分析

### 1. 事件类型不匹配

- **后端新事件类型**：`planning_thinking`, `planning_content`, `plan_status`, `plan`, `worker_start`, `worker_thinking`, `worker_content`, `worker_status`, `worker_complete`, `synthesis_thinking`, `synthesis_content`, `synthesis_status` 等
- **前端旧事件类型**：`thinking`, `content`, `plan`, `worker`, `synthesis` 等
- **问题**：前端无法正确处理新的细粒度事件类型

### 2. 事件处理逻辑混乱

- `handleSSEEvent` 函数中所有事件类型混在一起处理
- 缺少清晰的事件分类和路由
- 消息创建和更新逻辑分散，难以维护

### 3. 消息状态管理不清晰

- 没有统一的消息状态管理
- 流式更新逻辑分散在多个函数中
- 缺少消息生命周期管理

### 4. UI 组件结构不够灵活

- `MessageItem` 组件需要硬编码处理各种事件类型
- 缺少可扩展的组件结构

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    index.vue (主组件)                        │
│  - SSE 连接管理                                               │
│  - 调用 EventHandlerManager                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              EventHandlerManager (事件管理器)                 │
│  - 统一的事件处理入口                                         │
│  - 路由到不同阶段的事件处理器                                 │
│  - 管理消息状态                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────────┐   ┌───────────────────────┐
│ OrchestratorEvent     │   │ SimpleEvent           │
│ Handler               │   │ Handler               │
│                       │   │                       │
│ - PlanningHandler     │   │ - ThinkingHandler     │
│ - WorkerHandler       │   │ - ContentHandler      │
│ - SynthesisHandler    │   │ - ToolHandler         │
└───────────────────────┘   └───────────────────────┘
```

## 核心组件设计

### 1. EventHandlerManager (事件管理器)

**职责**:

- 统一的事件处理入口
- 根据模式路由到不同的处理器
- 管理消息状态和生命周期
- 提供消息查询和更新接口

**接口**:

```typescript
class EventHandlerManager {
  // 处理 SSE 事件
  handleEvent(event: StreamEvent): void

  // 获取所有消息
  getMessages(): Message[]

  // 获取特定阶段的消息
  getPhaseMessages(phase: 'planning' | 'worker' | 'synthesis'): Message[]

  // 重置状态（新会话时）
  reset(): void
}
```

### 2. OrchestratorEventHandler (Orchestrator 事件处理器)

**职责**:

- 处理 Orchestrator 模式的所有事件
- 路由到不同阶段的事件处理器
- 管理阶段状态转换

**接口**:

```typescript
class OrchestratorEventHandler {
  // 处理事件
  handleEvent(event: StreamEvent): void

  // 获取当前阶段
  getCurrentPhase(): 'planning' | 'worker' | 'synthesis' | null
}
```

### 3. PhaseHandler (阶段处理器)

#### PlanningPhaseHandler

```typescript
class PlanningPhaseHandler {
  // 处理 planning_thinking, planning_content, plan_status, plan
  handleEvent(event: StreamEvent): void

  // 获取当前计划
  getCurrentPlan(): PlanTask[]

  // 获取规划状态
  getStatus(): 'analyzing' | 'drafting' | 'generated'
}
```

#### WorkerPhaseHandler

```typescript
class WorkerPhaseHandler {
  // 处理 worker_start, worker_thinking, worker_content, worker_status, worker_complete
  handleEvent(event: StreamEvent): void

  // 获取所有 worker 状态
  getWorkers(): WorkerState[]

  // 获取特定 worker 的状态
  getWorker(taskId: string): WorkerState | null
}
```

#### SynthesisPhaseHandler

```typescript
class SynthesisPhaseHandler {
  // 处理 synthesis_thinking, synthesis_content, synthesis_status
  handleEvent(event: StreamEvent): void

  // 获取综合状态
  getStatus(): 'started' | 'thinking' | 'generating' | 'completed'
}
```

### 4. SimpleEventHandler (Simple 模式事件处理器)

**职责**:

- 处理 Simple 模式的事件（thinking, content）
- 管理简单消息流

**接口**:

```typescript
class SimpleEventHandler {
  handleEvent(event: StreamEvent): void
}
```

## 消息数据模型

### Message 接口扩展

```typescript
interface Message {
  /**
   * 唯一标识
   */
  id: string
  type: 'user' | 'ai'
  content: string
  /**
   * 原始文本（用于 markdown 渲染）
   */
  rawText?: string

  /**
   * 阶段信息
   */
  phase?: 'planning' | 'worker' | 'synthesis' | 'simple'
  /**
   * 新的事件类型
   */
  eventType?: StreamEventType

  /**
   * Planning 阶段
   */
  planningData?: {
    status?: 'analyzing' | 'drafting' | 'generated'
    plan?: PlanTask[]
  }

  /**
   * Worker 阶段
   */
  workerData?: {
    taskId: string
    task: string
    status: 'pending' | 'running' | 'completed' | 'error'
    /**
     * 流式累加
     */
    thinking?: string
    /**
     * 流式累加
     */
    content?: string
  }

  /**
   * Synthesis 阶段
   */
  synthesisData?: {
    status?: 'started' | 'thinking' | 'generating' | 'completed'
    thinking?: string /**
                       * 流式累加
                       */
    /**
     * 流式累加
     */
    content?: string
  }

  /**
   * 工具调用
   */
  toolCalls?: Array<{
    toolName: string
    args: any
    result?: any
    executionTime?: number
  }>

  timestamp: number
}
```

### PlanTask 接口

```typescript
interface PlanTask {
  taskId: string
  task: string
  dependencies?: string[]
  status?: 'pending' | 'running' | 'completed'
}
```

### WorkerState 接口

```typescript
interface WorkerState {
  taskId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'error'
  thinking: string              // 流式累加
  content: string               // 流式累加
  toolCalls?: Array<{...}>
}
```

## 事件处理映射

### Orchestrator 模式事件映射

| SSE Event Type       | Handler               | Message 更新方式                      |
| -------------------- | --------------------- | ------------------------------------- |
| `session`            | EventHandlerManager   | 设置 sessionId                        |
| `plan_status`        | PlanningPhaseHandler  | 更新/创建 planning 消息的状态         |
| `planning_thinking`  | PlanningPhaseHandler  | 流式累加到 planning 消息的 thinking   |
| `planning_content`   | PlanningPhaseHandler  | 流式累加到 planning 消息的 content    |
| `plan`               | PlanningPhaseHandler  | 添加到 planning 消息的 plan 数组      |
| `worker_start`       | WorkerPhaseHandler    | 创建新的 worker 消息                  |
| `worker_thinking`    | WorkerPhaseHandler    | 流式累加到对应 worker 消息的 thinking |
| `worker_content`     | WorkerPhaseHandler    | 流式累加到对应 worker 消息的 content  |
| `worker_status`      | WorkerPhaseHandler    | 更新 worker 消息的状态                |
| `worker_complete`    | WorkerPhaseHandler    | 更新 worker 消息状态为 completed      |
| `synthesis_status`   | SynthesisPhaseHandler | 更新/创建 synthesis 消息的状态        |
| `synthesis_thinking` | SynthesisPhaseHandler | 流式累加到 synthesis 消息的 thinking  |
| `synthesis_content`  | SynthesisPhaseHandler | 流式累加到 synthesis 消息的 content   |
| `tool_call`          | PhaseHandler          | 添加到当前阶段消息的 toolCalls        |
| `tool_result`        | PhaseHandler          | 更新对应 toolCall 的 result           |
| `error`              | EventHandlerManager   | 创建错误消息                          |
| `done`               | EventHandlerManager   | 标记流式输出完成                      |

### Simple 模式事件映射

| SSE Event Type | Handler             | Message 更新方式            |
| -------------- | ------------------- | --------------------------- |
| `session`      | EventHandlerManager | 设置 sessionId              |
| `thinking`     | SimpleEventHandler  | 流式累加到消息的 thinking   |
| `content`      | SimpleEventHandler  | 流式累加到消息的 content    |
| `tool_call`    | SimpleEventHandler  | 添加到消息的 toolCalls      |
| `tool_result`  | SimpleEventHandler  | 更新对应 toolCall 的 result |
| `error`        | EventHandlerManager | 创建错误消息                |
| `done`         | EventHandlerManager | 标记流式输出完成            |

## UI 组件结构

### 消息组件层次

```
MessageList
├── PlanningMessage (规划阶段消息)
│   ├── PlanningStatus (状态显示)
│   ├── PlanningThinking (思考过程，可选)
│   ├── PlanningContent (草稿内容，可选)
│   └── PlanList (任务列表)
├── WorkerMessage (Worker 阶段消息，可能有多个)
│   ├── WorkerHeader (任务标题和状态)
│   ├── WorkerThinking (思考过程，可选)
│   ├── WorkerContent (内容输出)
│   └── WorkerTools (工具调用列表，可选)
├── SynthesisMessage (综合阶段消息)
│   ├── SynthesisStatus (状态显示)
│   ├── SynthesisThinking (思考过程，可选)
│   └── SynthesisContent (最终答案)
└── SimpleMessage (Simple 模式消息)
    ├── Thinking (思考过程，可选)
    └── Content (内容输出)
```

## 状态管理

### 消息状态生命周期

```
Planning 阶段:
  analyzing → drafting → generated

Worker 阶段 (每个 worker):
  pending → running → completed/error

Synthesis 阶段:
  started → thinking → generating → completed
```

### 消息创建时机

1. **Planning 阶段**：
   - 首次收到 `plan_status` 时创建 planning 消息
   - 后续事件更新该消息

2. **Worker 阶段**：
   - 收到 `worker_start` 时创建新的 worker 消息
   - 每个 taskId 对应一个 worker 消息

3. **Synthesis 阶段**：
   - 首次收到 `synthesis_status` 时创建 synthesis 消息
   - 后续事件更新该消息

## 代码组织

```
apps/web/src/views/mcp/
├── index.vue                    (主组件，SSE 连接)
├── components/
│   ├── MessageList.vue         (消息列表容器)
│   ├── MessageItem.vue         (消息项，路由到具体组件)
│   ├── StatusBar.vue            (状态栏)
│   ├── ConfigPanel.vue          (配置面板)
│   └── messages/                (消息类型组件)
│       ├── PlanningMessage.vue
│       ├── WorkerMessage.vue
│       ├── SynthesisMessage.vue
│       └── SimpleMessage.vue
└── handlers/                    (事件处理器)
    ├── EventHandlerManager.ts   (主管理器)
    ├── OrchestratorEventHandler.ts
    ├── SimpleEventHandler.ts
    └── phases/
        ├── PlanningPhaseHandler.ts
        ├── WorkerPhaseHandler.ts
        └── SynthesisPhaseHandler.ts
```

## 实现步骤

1. ✅ 创建设计文档（当前步骤）
2. ⏳ 定义 TypeScript 类型和接口
3. ⏳ 创建 EventHandlerManager 框架
4. ⏳ 创建 OrchestratorEventHandler 框架
5. ⏳ 创建各阶段处理器框架（Planning/Worker/Synthesis）
6. ⏳ 创建 SimpleEventHandler 框架
7. ⏳ 实现 Planning 阶段事件处理

8. ⏳ 实现 Worker 阶段事件处理
9. ⏳ 实现 Synthesis 阶段事件处理
10. ⏳ 创建新的消息组件（PlanningMessage, WorkerMessage, SynthesisMessage）
11. ⏳ 更新 MessageItem 组件以使用新组件
12. ⏳ 集成到 index.vue
13. ⏳ 测试验证

## 关键设计决策

### 1. 消息聚合策略

- **Planning 阶段**：所有 planning 相关事件聚合到一个消息中
- **Worker 阶段**：每个 worker 独立一个消息（支持并行显示）
- **Synthesis 阶段**：所有 synthesis 相关事件聚合到一个消息中

### 2. 流式更新策略

- 所有文本类型事件（thinking, content）都支持流式累加
- 使用响应式数据，自动触发 UI 更新
- 避免频繁的 DOM 操作，使用 Vue 的响应式系统

### 3. 状态同步

- 使用 Vue 的 reactive/ref 管理消息状态
- 事件处理器直接更新响应式数据
- UI 组件自动响应数据变化

### 4. 错误处理

- 错误事件创建独立的错误消息
- 不影响其他阶段的消息显示
- 提供错误重试机制（可选）

## 性能考虑

1. **消息数量控制**：限制历史消息数量，避免内存泄漏
2. **虚拟滚动**：如果消息过多，考虑使用虚拟滚动
3. **防抖处理**：流式更新时，避免过于频繁的 DOM 更新
4. **内存管理**：及时清理已完成的消息数据
