# Event 处理框架设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    API Server (server.ts)                    │
│  - 接收请求，设置 SSE                                         │
│  - 调用 StreamEventHandler                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              StreamEventHandler (核心管理器)                  │
│  - 统一的事件处理入口                                         │
│  - 管理不同模式（orchestrator/simple）                       │
│  - 事件过滤和验证                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────────┐   ┌───────────────────────┐
│ OrchestratorEvent     │   │ SimpleEvent           │
│ Handler               │   │ Handler               │
│                       │   │                       │
│ - Planning 阶段处理    │   │ - Thinking 处理        │
│ - Worker 阶段处理     │   │ - Content 处理         │
│ - Synthesis 阶段处理  │   │ - Tool 处理           │
└───────────────────────┘   └───────────────────────┘
        │
        ├─── PlanningPhaseHandler
        ├─── WorkerPhaseHandler (监听 EventBridge)
        └─── SynthesisPhaseHandler
```

## 核心组件

### 1. StreamEventHandler (主管理器)

**职责**:

- 统一的事件处理入口
- 根据模式路由到不同的处理器
- 事件过滤（空内容等）
- 错误处理

**接口**:

```typescript
class StreamEventHandler {
  // 处理 orchestrator 模式
  async handleOrchestratorStream(
    options: OrchestratorStreamOptions,
    onStream: (event: StreamEvent) => void
  ): Promise<void>

  // 处理 simple 模式
  async handleSimpleStream(
    chatManager: ChatManager,
    message: string,
    onStream: (event: StreamEvent) => void
  ): Promise<void>
}
```

### 2. OrchestratorEventConverter

**职责**:

- 将 LangGraph 的原始事件转换为新的 SSE 事件类型
- 管理阶段状态（Planning/Worker/Synthesis）
- 处理 Worker 事件的监听和转换

**接口**:

```typescript
class OrchestratorEventConverter {
  // 转换 LangGraph 事件
  convertLangGraphEvent(
    event: LangGraphEvent,
    state: ConverterState
  ): StreamEvent[]

  // 监听 Worker EventBridge 并转换
  setupWorkerEventBridge(
    eventBridge: OrchestratorEventBridge,
    onStream: (event: StreamEvent) => void
  ): void
}
```

### 3. PhaseHandler (阶段处理器)

**职责**:

- 处理特定阶段的事件转换
- 维护阶段状态
- 生成对应的事件

#### PlanningPhaseHandler

```typescript
class PlanningPhaseHandler {
  handleEvent(event: LangGraphEvent): StreamEvent[]
  // 处理 planning_thinking, planning_content, plan_status, plan
}
```

#### WorkerPhaseHandler

```typescript
class WorkerPhaseHandler {
  // 监听 EventBridge 并转换
  setupEventBridge(
    eventBridge: OrchestratorEventBridge,
    onStream: (event: StreamEvent) => void
  ): void

  // 处理 worker 相关事件
  handleEvent(event: LangGraphEvent): StreamEvent[]
}
```

#### SynthesisPhaseHandler

```typescript
class SynthesisPhaseHandler {
  handleEvent(event: LangGraphEvent): StreamEvent[]
  // 处理 synthesis_thinking, synthesis_content, synthesis_status
}
```

## 事件转换映射

### LangGraph Event → SSE Event

| LangGraph Event                     | Tags                       | SSE Event                                            |
| ----------------------------------- | -------------------------- | ---------------------------------------------------- |
| `on_custom_event` (reasoning_chunk) | `orchestrator_planning`    | `planning_thinking`                                  |
| `on_chat_model_stream`              | `orchestrator_planning`    | `planning_content`                                   |
| `on_chain_end`                      | `orchestrator` (plan)      | `plan` (多个任务)                                    |
| `on_chain_end`                      | `orchestrator` (plan)      | `plan_status: 'generated'`                           |
| `on_chat_model_stream`              | `worker_*`                 | → EventBridge → `worker_thinking` / `worker_content` |
| `on_chain_end`                      | `worker` / `generalWorker` | `worker_complete`                                    |
| `on_chat_model_stream`              | `orchestrator_synthesis`   | `synthesis_thinking` / `synthesis_content`           |

### EventBridge Event → SSE Event

| EventBridge Event                       | SSE Event         |
| --------------------------------------- | ----------------- |
| `{ type: 'thinking', content: string }` | `worker_thinking` |
| `{ type: 'content', content: string }`  | `worker_content`  |
| `{ type: 'complete' }`                  | `worker_complete` |

## 状态管理

### ConverterState

```typescript
interface ConverterState {
  /**
   * Planning 阶段
   */
  planGenerated: boolean
  planningStatus: 'analyzing' | 'drafting' | 'generated'

  /**
   * Worker 阶段
   */
  activeWorkers: Map<string, WorkerState>

  /**
   * Synthesis 阶段
   */
  synthesisStatus: 'started' | 'thinking' | 'generating' | 'completed'
}
```

### WorkerState

```typescript
interface WorkerState {
  taskId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'error'
  started: boolean
}
```

## 实现步骤

1. ✅ 创建 `StreamEventHandler` 主类框架
2. ✅ 创建 `OrchestratorEventConverter` 框架
3. ✅ 创建各阶段处理器框架（Planning/Worker/Synthesis）
4. ⏳ 实现 Planning 阶段事件转换
5. ⏳ 实现 Worker 阶段事件转换（包括 EventBridge 监听）
6. ⏳ 实现 Synthesis 阶段事件转换
7. ⏳ 集成到 server.ts

## 代码组织

```
packages/orchestrator/src/api/
├── streamAdapter.ts          (已更新)
├── types.ts                  (已更新)
├── server.ts                 (需要更新)
└── handlers/
    ├── StreamEventHandler.ts        (主管理器)
    ├── OrchestratorEventConverter.ts (事件转换器)
    └── phases/
        ├── PlanningPhaseHandler.ts
        ├── WorkerPhaseHandler.ts
        └── SynthesisPhaseHandler.ts
```
