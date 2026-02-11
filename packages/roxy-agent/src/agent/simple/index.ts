import type { BaseMessage } from '@langchain/core/messages'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { simple } from './simple'

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

export const AgentState = Annotation.Root({
  enableThinking: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),

  messages: Annotation<BaseMessage[]>({
    /**
     * 直接替换。
     */
    reducer: (x, y) => {
      return y ?? x
    },
    default: () => [],
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
})

// Simple Graph Builder (简单模式 - 只有一个节点)
const simpleBuilder = new StateGraph(AgentState)
  .addNode('simple', simple)
  .addEdge(START, 'simple')
  .addEdge('simple', END)

// const saver = new MemorySaver()

/**
 * 编译 Simple Graph
 */
export const simpleGraph = simpleBuilder.compile()
