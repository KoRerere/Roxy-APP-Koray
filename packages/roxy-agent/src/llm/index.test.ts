import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  DEEPSEEK_MAX_OUTPUT_TOKENS,
  DEEPSEEK_THINKING_BUDGET_TOKENS,
  createLLMFromModelInfo,
} from './index'

it('reserves output capacity beyond the DeepSeek thinking budget', () => {
  // Regression: deepseek-v4-pro inherited LangChain's 4096-token fallback while thinking also used 4096 tokens.
  // Fixed by: Roxy configures an explicit 8192-token output cap with a smaller 4096-token thinking budget.
  const llm = createLLMFromModelInfo({
    text_model: {
      model: 'deepseek-v4-pro',
      api_format: 'anthropic',
    },
  }, { enableThinking: true }) as any

  assert.equal(DEEPSEEK_MAX_OUTPUT_TOKENS, 8192)
  assert.equal(DEEPSEEK_THINKING_BUDGET_TOKENS, 4096)
  assert.equal(llm.maxTokens, DEEPSEEK_MAX_OUTPUT_TOKENS)
  assert.deepEqual(llm.thinking, {
    type: 'enabled',
    budget_tokens: DEEPSEEK_THINKING_BUDGET_TOKENS,
  })
  assert.ok(llm.maxTokens > llm.thinking.budget_tokens)
})
