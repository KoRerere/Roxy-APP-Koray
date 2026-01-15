# SSE 流式输出 Event 类型规划文档

## 设计原则

1. **所有 event 类型都必须是流式输出的** - 即使是状态类事件，也要支持增量更新
2. **明确区分不同阶段** - Planning、Worker、Synthesis 三个阶段的事件需要清晰区分
3. **Worker 消息完整流式输出** - 每个 worker 的 thinking 和 content 都要实时流式输出给前端
4. **统一的数据结构** - 所有 event 遵循统一的数据格式，便于前端处理

## Event 类型体系

### 1. 会话管理类

#### `session`

- **用途**: 会话初始化，返回 sessionId
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'session',
  data: {
    sessionId: string
  },
  timestamp: number
}
```

### 2. 规划阶段 (Planning Phase)

#### `planning_thinking`

- **用途**: 规划阶段的思考过程（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'planning_thinking',
  data: {
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `planning_content`

- **用途**: 规划阶段的草稿内容（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'planning_content',
  data: {
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `plan_status`

- **用途**: 规划阶段的状态更新
- **流式**: 是（状态更新）
- **数据结构**:

```typescript
{
  type: 'plan_status',
  data: {
    status: 'analyzing' | 'drafting' | 'generated'
  },
  timestamp: number
}
```

#### `plan`

- **用途**: 计划任务项（流式添加）
- **流式**: 是（增量添加任务）
- **数据结构**:

```typescript
{
  type: 'plan',
  data: {
    task: {
      taskId: string
      task: string
      dependencies?: string[]
    }
    // 或者支持批量添加
    // tasks?: Array<{...}>  // 可选：一次添加多个任务
  },
  timestamp: number
}
```

**说明**:

- 每次发送一个任务项，前端累积构建完整计划
- 支持逐步看到计划的形成过程
- 当所有任务都添加完成后，可以通过 `plan_status: 'generated'` 标记计划完成

### 3. Worker 阶段 (Worker Phase)

#### `worker_start`

- **用途**: Worker 开始执行
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'worker_start',
  data: {
    taskId: string
    task: string
  },
  timestamp: number
}
```

#### `worker_thinking`

- **用途**: Worker 的思考过程（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'worker_thinking',
  data: {
    taskId: string
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `worker_content`

- **用途**: Worker 的内容输出（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'worker_content',
  data: {
    taskId: string
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `worker_status`

- **用途**: Worker 的状态更新
- **流式**: 是（状态更新）
- **数据结构**:

```typescript
{
  type: 'worker_status',
  data: {
    taskId: string
    status: 'running' | 'completed' | 'error'
    message?: string
  },
  timestamp: number
}
```

#### `worker_complete`

- **用途**: Worker 完成执行
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'worker_complete',
  data: {
    taskId: string
    result?: any
  },
  timestamp: number
}
```

### 4. 综合阶段 (Synthesis Phase)

#### `synthesis_thinking`

- **用途**: 综合阶段的思考过程（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'synthesis_thinking',
  data: {
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `synthesis_content`

- **用途**: 综合阶段的最终答案（流式）
- **流式**: 是（增量）
- **数据结构**:

```typescript
{
  type: 'synthesis_content',
  data: {
    text: string  // 增量文本
  },
  timestamp: number
}
```

#### `synthesis_status`

- **用途**: 综合阶段的状态更新
- **流式**: 是（状态更新）
- **数据结构**:

```typescript
{
  type: 'synthesis_status',
  data: {
    status: 'started' | 'thinking' | 'generating' | 'completed'
  },
  timestamp: number
}
```

### 5. 工具调用类

#### `tool_call`

- **用途**: 工具调用开始
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'tool_call',
  data: {
    toolName: string
    args: any
    taskId?: string  // 如果是在 worker 中调用
  },
  timestamp: number
}
```

#### `tool_result`

- **用途**: 工具调用结果
- **流式**: 否（一次性，但结果可能很大）
- **数据结构**:

```typescript
{
  type: 'tool_result',
  data: {
    toolName: string
    result: any
    executionTime?: number
    taskId?: string  // 如果是在 worker 中调用
  },
  timestamp: number
}
```

### 6. 系统类

#### `error`

- **用途**: 错误信息
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'error',
  data: {
    message: string
    details?: any
    taskId?: string  // 如果是在 worker 中出错
  },
  timestamp: number
}
```

#### `done`

- **用途**: 流式输出完成
- **流式**: 否（一次性）
- **数据结构**:

```typescript
{
  type: 'done',
  data: {
    finalAnswer?: string
  },
  timestamp: number
}
```

## 完整的 Event 类型定义

```typescript
export type StreamEventType
  = | 'session'
    | 'planning_thinking'
    | 'planning_content'
    | 'plan_status'
    | 'plan'
    | 'worker_start'
    | 'worker_thinking'
    | 'worker_content'
    | 'worker_status'
    | 'worker_complete'
    | 'synthesis_thinking'
    | 'synthesis_content'
    | 'synthesis_status'
    | 'tool_call'
    | 'tool_result'
    | 'error'
    | 'done'

export interface StreamEvent {
  type: StreamEventType
  data: any
  timestamp?: number
}
```

## 事件流时序

### Orchestrator 模式完整流程

```
1. session          → 会话初始化
2. plan_status      → status: 'analyzing'
3. planning_thinking → [流式] 规划思考
4. planning_content  → [流式] 规划草稿
5. plan_status      → status: 'drafting'
6. plan             → [流式] task1 添加到计划
7. plan             → [流式] task2 添加到计划
8. plan             → [流式] task3 添加到计划
9. plan_status      → status: 'generated'
10. worker_start     → taskId: 'task1'
11. worker_thinking   → [流式] worker1 思考
12. worker_content    → [流式] worker1 内容
13. worker_status    → taskId: 'task1', status: 'running'
14. tool_call        → [可选] worker1 调用工具
15. tool_result      → [可选] worker1 工具结果
16. worker_complete  → taskId: 'task1'
17. worker_start     → taskId: 'task2'
18. ... (重复 worker 流程)
19. synthesis_status → status: 'started'
20. synthesis_thinking → [流式] 综合思考
21. synthesis_content  → [流式] 最终答案
22. synthesis_status    → status: 'completed'
23. done             → 完成
```

### Simple 模式流程

```
1. session          → 会话初始化
2. thinking         → [流式] 思考过程（如果启用）
3. content          → [流式] 内容输出
4. tool_call        → [可选] 工具调用
5. tool_result      → [可选] 工具结果
6. done             → 完成
```

**注意**: Simple 模式中的 `thinking` 和 `content` 需要根据实际使用场景决定是否需要细分为不同阶段的事件类型。

## 实现要点

### 1. StreamAdapter 更新

- 为每个新的 event 类型添加对应的静态方法
- 保持统一的 SSE 格式化逻辑

### 2. OrchestratorStreamHandler 更新

- Planning 阶段：输出 `planning_thinking` 和 `planning_content`
- Worker 阶段：通过 onStream 输出 `worker_thinking` 和 `worker_content`（目前缺失）
- Synthesis 阶段：输出 `synthesis_thinking` 和 `synthesis_content`

### 3. Worker 消息流式输出

- 在 `handleOrchestratorStream` 中，当 `onStream` 存在时，监听 `eventBridge` 的事件
- 将 worker 的 thinking 和 content 转换为对应的 event 并输出

### 4. 空内容过滤

- 继续过滤空的 content 事件（但保留 thinking 事件，即使为空）
- 确保流式输出的质量

## 下一步行动

1. ✅ 完成规划文档（当前步骤）
2. ⏳ 更新 `types.ts` 中的 `StreamEventType` 定义
3. ⏳ 更新 `streamAdapter.ts` 添加所有新的 event 类型方法
4. ⏳ 更新 `OrchestratorStreamHandler` 实现 worker 消息流式输出
5. ⏳ 更新 `server.ts` 中的 event 处理逻辑
6. ⏳ 测试验证所有 event 类型的流式输出
