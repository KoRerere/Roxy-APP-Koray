import { describe, expect, it } from 'vitest'
import { ask_userTool } from '../../../src/tools/builtin/ask_user.ts'
import type {
  IClarificationHandler,
  ClarificationRequest,
  ClarificationResult,
  ToolContext,
} from '../../../src/core/interfaces.ts'

function ctx(): ToolContext {
  return { agentId: 'a', traceId: 't1', signal: new AbortController().signal }
}

class AutoHandler implements IClarificationHandler {
  readonly received: ClarificationRequest[] = []
  constructor(private readonly answer: string = JSON.stringify({ project: 'yes' })) {}
  request(req: ClarificationRequest): Promise<ClarificationResult> {
    this.received.push(req)
    return Promise.resolve({ answer: this.answer })
  }
}

describe('ask_user tool', () => {
  it("has descriptor with name 'ask_user', builtin source, and read-only closed-world annotations", () => {
    const { descriptor } = ask_userTool(new AutoHandler())
    expect(descriptor.name).toBe('ask_user')
    expect(descriptor.source).toBe('builtin')
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })

  it("returns the clarification handler's structured answers as content", async () => {
    const handler = new AutoHandler(JSON.stringify({ language: 'TypeScript' }))
    const { handler: toolHandler } = ask_userTool(handler)
    const result = await toolHandler(
      {
        questions: [
          {
            header: 'Language',
            id: 'language',
            question: 'Which language should we use?',
            options: [
              { label: 'TypeScript', description: 'Use the existing project language.' },
              { label: 'JavaScript', description: 'Avoid a TypeScript build step.' },
            ],
          },
        ],
      },
      ctx(),
    )
    expect(result.isError).toBe(false)
    expect(result.content).toBe(JSON.stringify({ language: 'TypeScript' }))
  })

  it('passes all questions to the clarification handler', async () => {
    // Regression: ask_user only accepted one top-level question, so a model
    // could not request several independent decisions in one user turn.
    // Fixed by: accept the RequestUserInput questions array as the entire input.
    const handler = new AutoHandler()
    const { handler: toolHandler } = ask_userTool(handler)
    await toolHandler(
      {
        questions: [
          {
            header: 'Project',
            id: 'project',
            question: 'What is the project name?',
            options: [
              { label: 'RoxyBrowser', description: 'Use the current product name.' },
              { label: 'New name', description: 'Choose a different project name.' },
            ],
          },
          {
            header: 'Scope',
            id: 'scope',
            question: 'Which scope should we implement?',
            options: [
              { label: 'Focused', description: 'Change only the requested workflow.' },
              { label: 'Broad', description: 'Include adjacent improvements.' },
            ],
          },
        ],
      },
      ctx(),
    )
    expect(handler.received[0]).toBeDefined()
    expect(handler.received[0]?.questions).toHaveLength(2)
    expect(handler.received[0]!.questions?.[1]?.id).toBe('scope')
  })

  it('rejects the legacy single-question input shape', async () => {
    const { handler: toolHandler } = ask_userTool(new AutoHandler())
    const result = await toolHandler({ question: 'Which language?' }, ctx())
    expect(result.isError).toBe(true)
  })

  it('preserves empty structured answers from the handler', async () => {
    const handler = new AutoHandler('{}')
    const { handler: toolHandler } = ask_userTool(handler)
    const result = await toolHandler(
      {
        questions: [
          {
            header: 'Anything',
            id: 'anything',
            question: 'Should we continue?',
            options: [
              { label: 'Continue', description: 'Proceed with the current approach.' },
              { label: 'Stop', description: 'End the current task.' },
            ],
          },
        ],
      },
      ctx(),
    )
    expect(result.isError).toBe(false)
    expect(result.content).toBe('{}')
  })
})
