import { AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import OpenAI from 'openai'
import { getReasoningContent } from '../../agent/utils'
import { env } from '../../config.js'
import { BaseLLMChat } from './baseLLMChart.js'

/**
 * Custom SiliconFlow chat implementation
 * Extracts reasoning_content and maps to standard reasoning field for consistency
 */
export class DeepSeek extends BaseLLMChat {
  protected extractReasoning(delta: any): string | undefined {
    // SiliconFlow uses delta.reasoning_content (not delta.reasoning)
    return delta.reasoning_content
  }

  protected getThinkingParamKey(): string {
    return 'enable_thinking'
  }

  async* _streamResponseChunks(
    messages: any[],
    options: this['ParsedCallOptions'],
    runManager?: any,
  ): AsyncGenerator<ChatGenerationChunk> {
    // Reset reasoning state for new stream
    this._reasoningStarted = false

    const client = new OpenAI({
      apiKey: env.LLM_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    })

    // Map messages to OpenAI/SiliconFlow format
    const messagesMapped = messages.map((m) => {
      const messageType = m.type

      // Determine role
      let role = 'user'
      if (messageType === 'ai')
        role = 'assistant'
      else if (messageType === 'system')
        role = 'system'
      else if (messageType === 'tool')
        role = 'tool'

      // Base message object
      const mapped: any = {
        role,
        content: m.content || '',
        reasoning_content: getReasoningContent(m) || '',
      }

      // Add tool-specific fields for assistant messages
      if (role === 'assistant' && (m as any).tool_calls && (m as any).tool_calls.length > 0) {
        mapped.tool_calls = (m as any).tool_calls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
          },
        }))
      }

      // Add tool_call_id for tool messages
      if (role === 'tool' && (m as any).tool_call_id) {
        mapped.tool_call_id = (m as any).tool_call_id
      }

      return mapped
    })

    // Get parent params
    const params = (this as any).invocationParams(options)

    // Get current model
    const currentModel = env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3'

    // Check if model supports thinking (DeepSeek models only)
    const isThinkingCapable = currentModel.toLowerCase().includes('deepseek')

    // Get thinking configuration only if model supports it
    const enableThinking = isThinkingCapable && (options as any).enable_thinking !== false
    // const thinkingBudget = Number.parseInt(process.env.SILICONFLOW_THINKING_BUDGET || '4096', 10)

    const payload: any = {
      ...params,
      messages: messagesMapped,
      // model: currentModel,
      // messages,
      // stream: true,
      // temperature: 0.7,
    }

    // Only add thinking parameters for DeepSeek models
    if (isThinkingCapable && enableThinking) {
      payload.enable_thinking = true
    }

    // Remove conflicting fields if invocationParams added them
    delete (payload as any).streaming
    delete (payload as any).n

    console.log('payload', payload)

    // Use the local client
    const stream = await client.chat.completions.create(payload as any) as any

    // State tracking for DeepSeek API bug workaround
    // When enable_thinking=true and tool calls complete, final response may be
    // incorrectly placed in reasoning_content instead of content
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let hasToolCalls = false
    let usage = {}

    for await (const chunk of stream) {
      // 特殊处理 deepseek 模型的 reasoning_content 字段
      const delta = chunk.choices[0]?.delta

      if (!delta)
        continue

      usage = chunk.usage

      // Extract reasoning_content and content from delta
      const reasoning_content = this.extractReasoning(delta)
      const content = delta.content || ''

      const finish_reason = chunk.choices[0]?.finish_reason
      const tool_calls = delta.tool_calls

      // Accumulate for DeepSeek API bug workaround
      accumulatedContent += content
      if (reasoning_content)
        accumulatedReasoning += reasoning_content
      if (tool_calls)
        hasToolCalls = true

      // Emit custom event for reasoning if present
      if (reasoning_content && runManager?.handleCustomEvent) {
        await runManager.handleCustomEvent('reasoning_chunk', { text: reasoning_content })
      }

      // Map OpenAI tool calls to LangChain ToolCallChunks
      let tool_call_chunks
      if (tool_calls) {
        tool_call_chunks = tool_calls.map((tc: any) => ({
          name: tc.function?.name,
          args: tc.function?.arguments,
          id: tc.id,
          index: tc.index,
          type: 'tool_call_chunk',
        }))
      }

      // Build response_metadata with only necessary fields to avoid usage field conflicts
      const response_metadata: any = {
        finish_reason,
        id: chunk.id,
        object: chunk.object,
        created: chunk.created,
        model: chunk.model,
      }

      // Only include usage statistics in the final chunk (when finish_reason is set)
      // This avoids "field already exists" errors from LangChain
      if (finish_reason && chunk.usage) {
        response_metadata.usage = chunk.usage

        if (env.DEBUG) {
          console.log(`[DEBUG] DeepSeek - Final usage:`, chunk.usage)
        }
      }

      // DeepSeek API bug workaround: When enable_thinking=true and tool calls complete,
      // the final response may be incorrectly placed in reasoning_content instead of content
      let finalContent = content
      let finalReasoning = reasoning_content
      if (finish_reason === 'stop' && !hasToolCalls) {
        const contentIsEmpty = !accumulatedContent.trim()
        const hasReasoning = accumulatedReasoning.trim().length > 0

        if (contentIsEmpty && hasReasoning) {
          // Use accumulated reasoning as the final content
          finalContent = accumulatedReasoning
          finalReasoning = undefined // Clear to avoid duplication
          if (process.env.DEBUG === 'true') {
            console.log(`[DEBUG] DeepSeek - Applied DeepSeek API bug workaround: using reasoning_content as content`)
          }
        }
      }

      // CRITICAL: Map reasoning_content to standard reasoning field
      // This ensures StreamHandler can extract thinking using standard paths
      const messageChunk = new AIMessageChunk({
        content: finalContent,
        tool_call_chunks,
        additional_kwargs: {
          reasoning: finalReasoning, // Map to standard field
          reasoning_content: finalReasoning, // Keep original for compatibility
        },
        response_metadata,
      })

      yield new ChatGenerationChunk({
        message: messageChunk,
        text: finalContent,
        generationInfo: {
          finish_reason,
          reasoning: finalReasoning,
        },
      })

      if (runManager) {
        await runManager.handleLLMNewToken(finalContent)
      }
    }

    await runManager?.handleLLMEnd({
      llmOutput: {
        tokenUsage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
        },
      },
    })
  }
}
