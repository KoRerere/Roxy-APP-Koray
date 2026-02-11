import type { ChatOpenAI } from '@langchain/openai'
import { AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import OpenAI from 'openai'
import { env } from '../../config.js'
import { providerBaseURL } from '../provider.js'
import { BaseLLMChat } from './baseLLMChart.js'

function handleMessage(messages: any) {
  // Map messages to OpenAI/DashScope format
  return messages.map((m: any) => {
    const messageType = m._getType()

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
}

/**
 * Custom DashScope chat implementation
 * Supports enable_thinking via extra_body for Qwen3 models
 */
export class Qwen extends BaseLLMChat {
  protected extractReasoning(delta: any): string | undefined {
    // DashScope uses delta.reasoning_content for thinking content
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
      baseURL: providerBaseURL.dashscope,
    })

    // Get parent params
    const params = (this as any).invocationParams(options)

    const payload: any = {
      ...params,
      messages: handleMessage(messages),
      enable_thinking: params.enable_thinking,
      tools: params.tools,
      model: params.model,
      stream: params.stream,
      stream_options: {
        include_usage: true,
      },
      // enable_thinking: options.enable_thinking,
    }

    console.log('payload', payload)

    // Use the local client
    // Note: We're using 'as any' to bypass TypeScript type checking for extra_body
    // The actual API call will include enable_thinking in the request body
    const stream = await client.chat.completions.create(payload, {
      signal: options.signal,
    }) as any

    let usage: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    } = {}

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      // 千义通文的会在最后一个chunk，返回本次消耗的token信息。而且 chunk.choices 里面是空的。
      usage = chunk.usage

      if (!delta)
        continue

      // Extract reasoning_content and content from delta
      const reasoning_content = this.extractReasoning(delta)
      const content = delta.content || ''

      const finish_reason = chunk.choices[0]?.finish_reason
      const tool_calls = delta.tool_calls

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

      // Build response_metadata
      const response_metadata: any = {
        finish_reason,
        id: chunk.id,
        object: chunk.object,
        created: chunk.created,
        model: chunk.model,
      }

      // Only include usage statistics in the final chunk
      if (finish_reason && chunk.usage) {
        response_metadata.usage = chunk.usage
      }

      // Map reasoning_content to standard reasoning field
      const messageChunk = new AIMessageChunk({
        content,
        tool_call_chunks,
        additional_kwargs: {
          reasoning: reasoning_content, // Map to standard field
          reasoning_content, // Keep original for compatibility
        },
        response_metadata,
      })

      yield new ChatGenerationChunk({
        message: messageChunk,
        text: content,
        generationInfo: {
          finish_reason,
          reasoning: reasoning_content,
        },
      })

      if (runManager) {
        await runManager.handleLLMNewToken(content)
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
