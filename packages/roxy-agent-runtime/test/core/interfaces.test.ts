import { describe, expect, it } from 'vitest'
import type {
  HitlMode,
  ToolDescriptor,
  ToolSource,
  TrajectoryEvent,
  TrajectoryPhase,
} from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'
import { NotImplementedError } from '../../src/core/errors.ts'

describe('core interfaces (contract)', () => {
  it('ToolSource covers builtin / skill / mcp', () => {
    const sources: ToolSource[] = ['builtin', 'skill', 'mcp']
    expect(sources).toHaveLength(3)
  })

  it('ToolDescriptor supports standard tool annotations', () => {
    const desc: ToolDescriptor = {
      name: 'apply_patch',
      description: 'apply patch',
      inputSchema: testToolInputSchema,
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    }
    expect(desc.annotations?.destructiveHint).toBe(true)
  })

  it('ToolDescriptor supports successful direct turn completion', () => {
    const desc: ToolDescriptor = {
      name: 'task_report',
      description: 'save report',
      inputSchema: testToolInputSchema,
      source: 'builtin',
      returnDirect: true,
    }

    expect(desc.returnDirect).toBe(true)
  })

  it('HitlMode covers strict / delegate / full', () => {
    const modes: HitlMode[] = ['strict', 'delegate', 'full']
    expect(modes).toHaveLength(3)
  })

  it('TrajectoryPhase covers the full lifecycle', () => {
    const phases: TrajectoryPhase[] = [
      'model_thought',
      'tool_selected',
      'hitl_intercept',
      'tool_executed',
      'result_returned',
      'memory_trimmed',
      'error',
    ]
    expect(phases).toHaveLength(7)
  })

  it('TrajectoryEvent is well-formed', () => {
    const event: TrajectoryEvent = {
      traceId: 't1',
      ts: 0,
      phase: 'tool_selected',
      data: { toolName: 'ls' },
    }
    expect(event.phase).toBe('tool_selected')
  })

  it('NotImplementedError carries its feature name', () => {
    const err = new NotImplementedError('Thing.do')
    expect(err).toBeInstanceOf(Error)
    expect(err.feature).toBe('Thing.do')
    expect(err.message).toContain('Thing.do')
  })
})
