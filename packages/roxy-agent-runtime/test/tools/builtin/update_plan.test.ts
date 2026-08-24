import { describe, expect, it } from 'vitest'
import { updatePlanTool } from '../../../src/tools/builtin/update_plan.ts'
import { zodToJsonSchema } from '../../../src/tools/schema.ts'
import type { ToolEvent } from '../../../src/core/interfaces.ts'

function makeCtx(emit?: (event: ToolEvent) => void) {
  return { agentId: 'a', traceId: 't1', signal: new AbortController().signal, emit }
}

describe('updatePlanTool', () => {
  it('exposes update_plan with the requested plan shape', () => {
    const tool = updatePlanTool()
    expect(tool.descriptor.name).toBe('update_plan')
    expect(tool.descriptor.description).toBe(
      '更新任务计划，支持可选说明和步骤列表，并要求同一时间最多只有一个 `in_progress`',
    )
  })

  it('accepts explanation and plan in the requested shape', async () => {
    const events: ToolEvent[] = []
    const write = updatePlanTool()
    const result = await write.handler(
      {
        explanation: 'Split work into two steps',
        plan: [
          { step: 'Write outline', status: 'pending' },
          { step: 'Implement feature X', status: 'in_progress' },
          { step: 'Write tests', status: 'completed' },
        ],
      },
      makeCtx((event) => events.push(event)),
    )
    expect(result.isError).toBe(false)
    expect(result.content).toBe('Plan updated')
    expect(events).toEqual([
      {
        type: 'plan_updated',
        todos: [
          { content: 'Write outline', status: 'pending' },
          { content: 'Implement feature X', status: 'in_progress' },
          { content: 'Write tests', status: 'completed' },
        ],
      },
    ])
  })

  it('rejects multiple in_progress items', async () => {
    const write = updatePlanTool()
    const result = await write.handler(
      {
        plan: [
          { step: 'First', status: 'in_progress' },
          { step: 'Second', status: 'in_progress' },
        ],
      },
      makeCtx(),
    )
    expect(result.isError).toBe(true)
  })

  it('accepts missing explanation because it is optional', async () => {
    const write = updatePlanTool()
    const result = await write.handler({ plan: [{ step: 'Task', status: 'pending' }] }, makeCtx())
    expect(result.isError).toBe(false)
  })

  it('schemas the plan items and excludes ids/priorities', () => {
    const tool = updatePlanTool()
    const jsonSchema = zodToJsonSchema(tool.descriptor.inputSchema)
    expect(jsonSchema).toMatchObject({
      type: 'object',
      properties: {
        explanation: { type: 'string', description: 'Optional explanation for this plan update.' },
        plan: {
          type: 'array',
          description: 'The list of steps',
          items: {
            type: 'object',
            properties: {
              step: { type: 'string', description: 'Task step text.' },
              status: { enum: ['pending', 'in_progress', 'completed'], description: 'Step status.' },
            },
            required: ['step', 'status'],
          },
        },
      },
      required: ['plan'],
    })
  })
})
