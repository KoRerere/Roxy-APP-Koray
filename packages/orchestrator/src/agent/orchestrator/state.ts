import type { BaseMessage } from '@langchain/core/messages'
import { Annotation } from '@langchain/langgraph'

/**
 * The structure of a single subtask
 */
export interface Subtask {
  id: string
  description: string
  workerId?: string /**
                     * Worker ID for isolated MCP client
                     */
  assignedTo?: string
  status: 'pending' | 'running' | 'completed'
  result?: string
}

/**
 * Result structure returned by a worker
 */
export interface WorkerOutput {
  taskId: string
  content: string
  thinking?: string
}

/**
 * LangGraph 内部使用的 token usage 格式
 * 使用 total_tokens, prompt_tokens, completion_tokens
 * 区别于前端的 TokenUsage 接口（使用 input, output, total）
 */
export interface LangGraphTokenUsage {
  total_tokens: number
  input_tokens: number
  output_tokens: number
}

/**
 * Main State Graph Annotation
 * Defines the shared state object for the Orchestrator-Worker graph
 */
export const AgentState = Annotation.Root({
  // The original conversation history + new messages
  // 支持消息替换：如果 y 是一个包含 __replace 标记的对象，则替换而不是 concat
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      // 检查是否是替换操作（用于历史压缩）
      if (Array.isArray(y) && (y as any).__replace === true) {
        return y.filter((msg: any) => msg.__replace !== true)
      }
      return x.concat(y)
    },
    default: () => [],
  }),

  // 存储对话摘要（用于历史压缩）
  summary: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // The current plan (list of tasks)
  // We overwrite the plan when re-planning, but usually this is set once
  plan: Annotation<Subtask[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  // Results collected from parallel workers
  // We merge new results into the existing array
  worker_results: Annotation<WorkerOutput[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // The final answer synthesized by the orchestrator
  final_answer: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // Token usage tracking
  tokenUsage: Annotation<LangGraphTokenUsage>({
    reducer: (x, y) => ({
      input_tokens: (x.input_tokens || 0) + (y.input_tokens || 0),
      output_tokens: (x.output_tokens || 0) + (y.output_tokens || 0),
      total_tokens: (x.total_tokens || 0) + (y.total_tokens || 0),
    }),
    default: () => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }),
  }),

  // The thinking content from synthesis
  synthesis_thinking: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // Enable thinking mode for LLM calls
  enableThinking: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),

  // Session directory path for logging
  sessionDir: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
})
