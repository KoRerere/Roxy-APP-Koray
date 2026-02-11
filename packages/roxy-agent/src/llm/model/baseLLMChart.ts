import type { ChatGenerationChunk } from '@langchain/core/outputs'
import { ChatOpenAI } from '@langchain/openai'

/**
 * Base class for custom LLM chat implementations
 * Provides common interface for reasoning extraction across different providers
 */
export abstract class BaseLLMChat extends ChatOpenAI {
  protected _reasoningStarted: boolean = false

  /**
   * Each provider must implement custom streaming logic
   * This method handles the stream of message chunks from the provider's API
   */
  abstract _streamResponseChunks(
    messages: any[],
    options: this['ParsedCallOptions'],
    runManager?: any
  ): AsyncGenerator<ChatGenerationChunk>

  /**
   * Get provider-specific API configuration
   * @returns API configuration including key, baseURL, and optional headers
   */
  // protected abstract getAPIConfig(): {
  //   apiKey: string
  //   baseURL: string
  //   defaultHeaders?: Record<string, string>
  // }

  /**
   * Extract reasoning field from delta chunk (provider-specific)
   * @param delta - The delta object from the streaming chunk
   * @returns The reasoning content, or undefined if not present
   */
  protected abstract extractReasoning(delta: any): string | undefined

  /**
   * Get thinking parameter key for this provider
   * @returns The parameter name used to enable thinking mode
   */
  protected abstract getThinkingParamKey(): string
}
