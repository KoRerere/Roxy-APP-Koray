import { describe, expect, it } from 'vitest'
import { updatePlanTool } from '../../../src/tools/builtin/update_plan.ts'
import type { ToolContext, ToolEvent } from '../../../src/core/interfaces.ts'

function ctx(emit?: (event: ToolEvent) => void): ToolContext {
  return { agentId: 'a', traceId: 't', signal: new AbortController().signal, emit }
}

describe('update_plan tool', () => {
  it("has descriptor with name 'update_plan', builtin source", () => {
    const { descriptor } = updatePlanTool()
    expect(descriptor.name).toBe('update_plan')
    expect(descriptor.source).toBe('builtin')
  })

  it('returns and emits the complete updated list', async () => {
    const events: ToolEvent[] = []
    const { handler } = updatePlanTool()
    const input = {
      plan: [
        { step: 'First task', status: 'in_progress' },
        { step: 'Second task', status: 'completed' },
      ],
    }
    const result = await handler(
      input,
      ctx((event) => events.push(event)),
    )
    expect(result.isError).toBe(false)
    expect(result.content).toBe('Plan updated')
    expect(events).toEqual([
      {
        type: 'plan_updated',
        todos: [
          { content: 'First task', status: 'in_progress' },
          { content: 'Second task', status: 'completed' },
        ],
      },
    ])
  })

  it('returns isError when the input schema is violated', async () => {
    const { handler } = updatePlanTool()
    const result = await handler({ plan: [{ bad: true }] }, ctx())
    expect(result.isError).toBe(true)
  })

  it('does not retain state between snapshots', async () => {
    const events: ToolEvent[] = []
    const { handler } = updatePlanTool()
    const context = ctx((event) => events.push(event))
    await handler({ plan: [{ step: 'old', status: 'in_progress' }] }, context)
    await handler({ plan: [{ step: 'new', status: 'completed' }] }, context)
    expect(events.at(-1)).toEqual({
      type: 'plan_updated',
      todos: [{ content: 'new', status: 'completed' }],
    })
  })
})
