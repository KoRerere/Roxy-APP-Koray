import { z } from 'zod'
import type { PlanItem } from '../../core/interfaces.ts'
import type { BuiltinTool } from './index.ts'
import { defineTool } from '../schema.ts'

const planItemInputSchema = z.strictObject({
  step: z
    .string()
    .refine((value) => value.trim().length > 0, 'Plan step must not be empty.')
    .describe('Task step text.'),
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Step status.'),
})

export const updatePlanInputSchema = z
  .strictObject({
    explanation: z.string().optional().describe('Optional explanation for this plan update.'),
    plan: z.array(planItemInputSchema).describe('The list of steps'),
  })
  .superRefine((input, ctx) => {
    const inProgressCount = input.plan.filter((item) => item.status === 'in_progress').length
    if (inProgressCount > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['plan'],
        message: 'At most one plan step can be in_progress.',
      })
    }
  })

/** Replace the current task plan with a complete snapshot of steps and statuses. */
export function updatePlanTool(): BuiltinTool {
  return defineTool({
    name: 'update_plan',
    description: '更新任务计划，支持可选说明和步骤列表，并要求同一时间最多只有一个 `in_progress`',
    inputSchema: updatePlanInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, _ctx) => {
      const todos: PlanItem[] = input.plan.map((item) => ({ content: item.step, status: item.status }))
      _ctx.emit?.({ type: 'plan_updated', todos })
      return { content: 'Plan updated', isError: false }
    },
  })
}
