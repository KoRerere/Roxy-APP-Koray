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
  prompt_tokens: number
  completion_tokens: number
}

/**
 * Main State Graph Annotation
 * Defines the shared state object for the Orchestrator-Worker graph
 */
export const AgentState = Annotation.Root({
  // The original conversation history + new messages
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
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
  // tokenUsage: Annotation<LangGraphTokenUsage>({
  //     reducer: (x, y) => ({
  //         total_tokens: (x.total_tokens || 0) + (y.total_tokens || 0),
  //         prompt_tokens: (x.prompt_tokens || 0) + (y.prompt_tokens || 0),
  //         completion_tokens: (x.completion_tokens || 0) + (y.completion_tokens || 0),
  //     }),
  //     default: () => ({ total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }),
  // }),

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
