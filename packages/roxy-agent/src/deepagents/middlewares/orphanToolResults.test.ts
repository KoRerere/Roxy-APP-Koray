import assert from 'node:assert/strict'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { describe, it } from 'vitest'
import { repairOrphanToolUseMessages } from './orphanToolResults'

describe('orphan tool result repair', () => {
  it('inserts a synthetic ToolMessage before the next non-tool message', () => {
    const ai = new AIMessage({
      content: '',
      tool_calls: [{
        id: 'call_123',
        name: 'parallel_dispatch',
        args: {},
      }],
    })
    const nextUser = new HumanMessage('继续')

    const result = repairOrphanToolUseMessages([ai, nextUser])

    assert.equal(result.repairedCount, 1)
    assert.equal(result.messages.length, 3)
    assert.equal(result.messages[0], ai)
    assert.equal(result.messages[2], nextUser)

    const synthetic = result.messages[1] as ToolMessage
    assert.equal(synthetic._getType(), 'tool')
    assert.equal((synthetic as any).tool_call_id, 'call_123')
    assert.equal((synthetic as any).name, 'parallel_dispatch')
  })

  it('does not change a valid tool call/result sequence', () => {
    const ai = new AIMessage({
      content: '',
      tool_calls: [{
        id: 'call_ok',
        name: 'read_file',
        args: {},
      }],
    })
    const tool = new ToolMessage({
      content: 'ok',
      name: 'read_file',
      tool_call_id: 'call_ok',
    })

    const result = repairOrphanToolUseMessages([ai, tool, new HumanMessage('继续')])

    assert.equal(result.repairedCount, 0)
    assert.equal(result.messages.length, 3)
    assert.equal(result.messages[1], tool)
  })
})
