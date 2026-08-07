import { describe, expect, it } from 'vitest'
import { decodeLegacySse, legacySseEventToRunEvent, SseDecoder } from './sseDecoder'

describe('SseDecoder', () => {
  it('decodes split CRLF blocks, comments, and multiline data', () => {
    const decoder = new SseDecoder()
    expect(decoder.push(': keepalive\r\nevent: message\r\nid: 10\r\ndata: {"type":"content",\r\n')).toEqual([])
    expect(decoder.push('data: "data":{"contentId":"main","text":"hello"}}\r\n\r\n')).toEqual([{
      event: 'message',
      id: '10',
      data: '{"type":"content",\n"data":{"contentId":"main","text":"hello"}}',
      value: {
        type: 'content',
        data: { contentId: 'main', text: 'hello' },
      },
    }])
  })

  it('ignores DONE and flushes a final block without a trailing separator', () => {
    const decoder = new SseDecoder()
    expect(decoder.push('data: [DONE]\n\n')).toEqual([])
    expect(decoder.push('data: {"type":"done","data":{}}', true)).toHaveLength(1)
  })
})

describe('legacySseEventToRunEvent', () => {
  it('maps planning to todo_delta and worker content to content_delta with workerId', () => {
    expect(legacySseEventToRunEvent({
      event: 'message',
      data: '',
      id: '1',
      value: { type: 'planning', data: { todos: [{ content: 'step' }] } },
    })).toEqual({
      type: 'todo_delta',
      data: { todos: [{ content: 'step' }] },
    })

    expect(legacySseEventToRunEvent({
      event: 'message',
      data: '',
      id: '2',
      value: { type: 'worker_content', data: { taskId: 'worker-1', contentId: 'answer', text: 'done' } },
    })).toEqual({
      type: 'content_delta',
      data: { workerId: 'worker-1', contentId: 'answer', text: 'done' },
    })
  })

  it('converts a complete legacy stream without preserving legacy event names', () => {
    const events = decodeLegacySse([
      'data: {"type":"content","data":{"contentId":"answer","text":"hello"},"timestamp":100}',
      '',
      'data: {"type":"done","data":{},"timestamp":101}',
      '',
    ].join('\n'))
    expect(events.map(item => item.event.type)).toEqual(['content_delta', 'run_completed'])
    expect(events.map(item => item.timestamp)).toEqual([100, 101])
  })

  it('preserves legacy image results as canonical tool events', () => {
    const events = decodeLegacySse([
      'data: {"type":"image_generating","data":{"count":1}}',
      '',
      'data: {"type":"image_partial","data":{"index":0,"image":{"fileId":"image-1"}}}',
      '',
    ].join('\n'))
    expect(events).toEqual([
      {
        event: {
          type: 'tool_started',
          data: { toolName: 'image_generation', input: { count: 1 } },
        },
      },
      {
        event: {
          type: 'tool_finished',
          data: {
            toolName: 'image_generation',
            output: { index: 0, image: { fileId: 'image-1' } },
            toolId: 'image-0',
            status: 'success',
          },
        },
      },
    ])
  })
})
