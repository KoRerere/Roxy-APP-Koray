import assert from 'node:assert/strict'
import test from 'node:test'
import { buildToolResultDetails } from './toolResult'

test('pairs a tool result with its tool name and input', () => {
  const events = [
    {
      lineNo: 3,
      raw: '',
      summary: '',
      event: {
        type: 'assistant_turn',
        ts: 1_000,
        items: [{
          type: 'tool_call',
          callId: 'call-1',
          name: 'roxy_script_describe',
          arguments: { scriptPath: 'official:141' },
        }],
      },
    },
    {
      lineNo: 4,
      raw: '',
      summary: '',
      event: {
        type: 'tool_result',
        ts: 1_250,
        result: {
          tool_use_id: 'call-1',
          content: 'first\\nsecond',
          is_error: false,
        },
      },
    },
  ]

  assert.deepEqual(buildToolResultDetails(events).get(4), {
    toolUseId: 'call-1',
    toolName: 'roxy_script_describe',
    input: { scriptPath: 'official:141' },
    content: 'first\nsecond',
    failed: false,
    durationMs: 250,
  })
})

test('supports canonical tool_use blocks and missing call metadata', () => {
  const events = [
    {
      lineNo: 1,
      raw: '',
      summary: '',
      event: {
        type: 'assistant_turn',
        ts: 2_000,
        message: {
          content: [{ type: 'tool_use', id: 'tool-2', name: 'read_file', input: { path: '/tmp/a' } }],
        },
      },
    },
    {
      lineNo: 2,
      raw: '',
      summary: '',
      event: { type: 'tool_result', ts: 2_010, result: { tool_use_id: 'tool-2', content: { ok: true }, is_error: true } },
    },
    {
      lineNo: 3,
      raw: '',
      summary: '',
      event: { type: 'tool_result', ts: 2_020, result: { tool_use_id: 'unknown', content: 'no metadata' } },
    },
  ]

  const details = buildToolResultDetails(events)
  assert.equal(details.get(2)?.toolName, 'read_file')
  assert.deepEqual(details.get(2)?.input, { path: '/tmp/a' })
  assert.equal(details.get(2)?.content, '{\n  "ok": true\n}')
  assert.equal(details.get(2)?.failed, true)
  assert.equal(details.get(3)?.toolName, 'unknown')
  assert.equal(details.get(3)?.durationMs, undefined)
})
