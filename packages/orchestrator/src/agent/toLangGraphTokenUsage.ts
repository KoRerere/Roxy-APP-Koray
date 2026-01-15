import type { AIMessageChunk, MessageStructure } from '@langchain/core/messages'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import type { LangGraphTokenUsage } from './state'

function toLangGraphTokenUsage(msg: any): LangGraphTokenUsage {
  // 1) LangChain 标准 usage_metadata
  const u = msg?.usage_metadata
  if (u && (u.total_tokens ?? u.input_tokens ?? u.output_tokens) != null) {
    return {
      total_tokens: u.total_tokens ?? (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
      prompt_tokens: u.input_tokens ?? 0,
      completion_tokens: u.output_tokens ?? 0,
    }
  }

  // 2) Provider 原始字段（兼容 OpenAI / OpenAI-compatible）
  const ru = msg?.response_metadata?.tokenUsage ?? msg?.response_metadata?.usage
  if (ru) {
    // 这里字段名不同 provider 会变，做一些兜底
    const prompt = ru.prompt_tokens ?? ru.promptTokens ?? 0
    const completion = ru.completion_tokens ?? ru.completionTokens ?? 0
    const total = ru.total_tokens ?? ru.totalTokens ?? prompt + completion
    return { total_tokens: total, prompt_tokens: prompt, completion_tokens: completion }
  }

  // 3) 拿不到就记 0（有些 provider/stream 模式可能不给 usage）
  return { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
}

/**
 * 输出 LangGraph 的 token usage
 * @param config - LangGraphRunnableConfig
 * @param chunk - AIMessageChunk<MessageStructure>
 */
export function outputLangGraphTokenUsage(config: LangGraphRunnableConfig, chunk: AIMessageChunk<MessageStructure>) {
  if (chunk) {
    const langGraphTokenUsage = toLangGraphTokenUsage(chunk)
    const isValid = langGraphTokenUsage.total_tokens > 0 || langGraphTokenUsage.prompt_tokens > 0 || langGraphTokenUsage.completion_tokens > 0
    if (isValid) {
      config.writer?.({
        type: 'token_usage',
        data: langGraphTokenUsage,
      })
    }
  }
}
