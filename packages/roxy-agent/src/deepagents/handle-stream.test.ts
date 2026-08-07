import { describe, expect, it } from 'vitest'
import { handleStreamEvents, StreamState } from './handle-stream'

function onlyEvent(result: ReturnType<typeof handleStreamEvents>) {
  expect(result).toBeTruthy()
  const events = Array.isArray(result) ? result : [result]
  expect(events).toHaveLength(1)
  return events[0]!
}

describe('handleStreamEvents task id routing', () => {
  it('keeps main agent events unscoped when no worker taskId is set', () => {
    const state = new StreamState()

    const contentEvents = onlyEvent(handleStreamEvents(['messages', [{
      id: 'main-content',
      content: 'hello',
    }]], state))
    expect(contentEvents).toMatchObject({
      type: 'content_delta',
      data: {
        text: 'hello',
      },
    })
    expect((contentEvents as any).data.workerId).toBeUndefined()

    const toolEvents = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'parallel_dispatch',
      input: JSON.stringify({ assignments: [{}, {}] }),
      toolCallId: 'call-main',
    }], state))
    expect(toolEvents).toMatchObject({
      type: 'tool_started',
      data: {
        toolName: 'parallel_dispatch',
        assignmentsCount: 2,
      },
    })
    expect((toolEvents as any).data.workerId).toBeUndefined()

    const todoEvents = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'write_todos',
      input: JSON.stringify({ todos: [{ content: 'main todo', status: 'in_progress' }] }),
      toolCallId: 'call-todo-main',
    }], state))
    expect(todoEvents).toMatchObject({
      type: 'todo_delta',
    })
  })

  it('marks worker agent events with the workerId', () => {
    const state = new StreamState()
    state.setTaskId('profile-worker-1')

    const contentEvents = onlyEvent(handleStreamEvents(['messages', [{
      id: 'worker-content',
      content: 'worker hello',
    }]], state))
    expect(contentEvents).toMatchObject({
      type: 'content_delta',
      data: {
        workerId: 'profile-worker-1',
        text: 'worker hello',
      },
    })

    const toolEvents = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'browser_click',
      input: JSON.stringify({ ref: 'button' }),
      toolCallId: 'call-worker',
    }], state))
    expect(toolEvents).toMatchObject({
      type: 'tool_started',
      data: {
        toolName: 'browser_click',
        workerId: 'profile-worker-1',
      },
    })

    const todoEvents = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'write_todos',
      input: JSON.stringify({ todos: [{ content: 'worker todo', status: 'in_progress' }] }),
      toolCallId: 'call-todo-worker',
    }], state))
    expect(todoEvents).toMatchObject({
      type: 'todo_delta',
      data: {
        workerId: 'profile-worker-1',
      },
    })
  })

  it('uses the canonical template ref and relative file path for remote Skill tool events', () => {
    const state = new StreamState()

    const event = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'load_skill_file',
      input: JSON.stringify({
        ref: 'official:88',
        file: 'references/usage.md',
      }),
      toolCallId: 'remote-skill-call',
    }], state))

    expect(event).toMatchObject({
      type: 'tool_started',
      data: {
        toolName: 'load_skill_file',
        skillName: 'official:88',
        skillFilePath: 'official:88/references/usage.md',
      },
    })
  })

  it('uses the frontmatter name and default SKILL.md path for local Skill tool events', () => {
    const state = new StreamState()

    const event = onlyEvent(handleStreamEvents(['tools', {
      event: 'on_tool_start',
      name: 'load_skill_file',
      input: JSON.stringify({
        name: 'local-skill',
      }),
      toolCallId: 'local-skill-call',
    }], state))

    expect(event).toMatchObject({
      type: 'tool_started',
      data: {
        toolName: 'load_skill_file',
        skillName: 'local-skill',
        skillFilePath: 'local-skill/SKILL.md',
      },
    })
  })
})
