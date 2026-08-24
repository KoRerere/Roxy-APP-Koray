/**
 * E2E smoke tests — DeepSeek (Anthropic-native protocol).
 *
 * Run via:
 *   pnpm test:e2e
 *
 * Requires .env.e2e (copy .env.e2e.example and fill in DEEPSEEK_API_KEY).
 * Tests are auto-skipped when DEEPSEEK_API_KEY is absent.
 */
import { describe, expect, it } from 'vitest'
import { AgentRuntime } from '../../src/index.ts'
import { FullAccessHandler } from '../../src/hitl/handler.ts'
import { createLogger } from '../../src/logging/logger.ts'
import { InMemoryProvider } from '../../src/memory/memory.ts'
import { InMemoryTrajectoryRecorder } from '../../src/observability/trajectory.ts'
import { AnthropicProvider } from '../../src/provider/anthropic.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'

// ---------------------------------------------------------------------------
// Config — read from environment, fall back to sensible defaults
// ---------------------------------------------------------------------------

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'

function createE2eDefinition(keep = 8, hooks?: import('../../src/core/interfaces.ts').AgentLifecycleHooks) {
  return {
    model: DEEPSEEK_MODEL,
    maxTokens: 512,
    systemPrompt: 'You are a concise assistant. Answer in as few words as possible.',
    provider: new AnthropicProvider({
      model: DEEPSEEK_MODEL,
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseURL: DEEPSEEK_BASE_URL,
      defaultHeaders: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY ?? ''}` },
    }),
    memory: new InMemoryProvider(),
    tools: new ToolRegistry(),
    hitl: new FullAccessHandler(),
    recorder: new InMemoryTrajectoryRecorder(),
    logger: createLogger({ level: 'error' }),
    trimPolicy: { mode: 'turns' as const, keep },
    ...(hooks ? { hooks } : {}),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractText(messages: Array<{ role: string; content: unknown }>): string {
  return messages
    .map((m) => {
      if (typeof m.content === 'string') {
        return m.content
      }
      if (Array.isArray(m.content)) {
        return (m.content as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('')
      }
      return ''
    })
    .join(' ')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!DEEPSEEK_API_KEY)('e2e smoke — DeepSeek (Anthropic-native API)', () => {
  it('invoke — pure text response round-trip', async () => {
    const agent = await AgentRuntime.create(createE2eDefinition())
    try {
      const result = await agent.invoke('Reply with only the single word "pong" and nothing else.')
      expect(result.messages.length).toBeGreaterThan(0)
      const text = extractText(result.messages).toLowerCase()
      expect(text).toContain('pong')
      expect(result.trajectory.length).toBeGreaterThan(0)
    } finally {
      await agent.dispose()
    }
  })

  it('invoke — agent produces at least one trajectory event', async () => {
    const agent = await AgentRuntime.create(createE2eDefinition())
    try {
      const result = await agent.invoke('What is 2 + 2? Answer with only the number.')
      const phases = result.trajectory.map((e) => e.phase)
      expect(phases).toContain('model_thought')
    } finally {
      await agent.dispose()
    }
  })

  it('invoke — sessionId and id are non-empty strings', async () => {
    const agent = await AgentRuntime.create(createE2eDefinition())
    try {
      expect(typeof agent.id).toBe('string')
      expect(agent.id.length).toBeGreaterThan(0)
      expect(typeof agent.sessionId).toBe('string')
      expect(agent.sessionId.length).toBeGreaterThan(0)
    } finally {
      await agent.dispose()
    }
  })

  it('multi-turn — context trim does not cause API errors', async () => {
    // Use keep:2 so trimming fires on every turn after the first two.
    // Validates: (a) no Anthropic 400 on orphaned tool_results / assistant-first
    // history, (b) the agent continues producing valid responses after trim.
    const agent = await AgentRuntime.create(createE2eDefinition(2))
    try {
      // Turn 1 — primes history
      let result = await agent.invoke('Reply with only the single word "one".')
      expect(result.messages.length).toBeGreaterThan(0)

      // Turn 2 — history: [user1, a1, user2] → exceeds keep:2 → trim fires
      result = await agent.invoke('Reply with only the single word "two".')
      expect(result.messages.length).toBeGreaterThan(0)

      // Turn 3 — trim fires again; if trimmer produced invalid history the
      // Anthropic API would return 400 and result.messages would be empty.
      result = await agent.invoke('Reply with only the single word "three".')
      expect(result.messages.length).toBeGreaterThan(0)
      const text = extractText(result.messages).toLowerCase()
      expect(text).toContain('three')
    } finally {
      await agent.dispose()
    }
  })

  it('invoke — hooks fire during execution', async () => {
    const events: string[] = []
    const agent = await AgentRuntime.create(
      createE2eDefinition(8, {
        invoke: {
          before: () => {
            events.push('invoke.before')
          },
          after: () => {
            events.push('invoke.after')
          },
        },
        model: {
          before: () => {
            events.push('model.before')
          },
          after: () => {
            events.push('model.after')
          },
        },
      }),
    )
    try {
      await agent.invoke('Say hi.')
      expect(events).toContain('invoke.before')
      expect(events).toContain('invoke.after')
      expect(events).toContain('model.before')
      expect(events).toContain('model.after')
    } finally {
      await agent.dispose()
    }
  })
})
