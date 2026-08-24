/**
 * Provider abstraction surface. Re-exports the provider contract from core and
 * is the single import path other modules use to depend on the provider layer.
 */
export type { IModelProvider, ChatRequest, ChatResponse, ChatStreamChunk } from '../core/interfaces.ts'

export { AnthropicProvider } from './anthropic.ts'
export { DeepseekProvider } from './deepseek.ts'
export { FakeProvider, chatResponse } from './fake.ts'
export { OpenAIResponsesProvider } from './openai_responses.ts'
