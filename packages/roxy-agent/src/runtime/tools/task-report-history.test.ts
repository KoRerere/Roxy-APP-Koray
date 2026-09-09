import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RoxyRolloutStore } from '../rollout'
import { readTaskReportUsedWindows } from './task-report-history'

const roots: string[] = []

function createStore(): RoxyRolloutStore {
  const root = mkdtempSync(path.join(tmpdir(), 'roxy-report-history-'))
  roots.push(root)
  return new RoxyRolloutStore(root)
}

async function appendTool(
  store: RoxyRolloutStore,
  sessionId: string,
  name: string,
  input: unknown,
  content: string,
  isError = false,
): Promise<void> {
  await store.append(sessionId, {
    type: 'assistant_turn',
    items: [{ type: 'tool_call', id: name, callId: name, name, arguments: input, toolKind: 'function' }],
    stopReason: 'tool_use',
  })
  await store.append(sessionId, {
    type: 'tool_result',
    result: { type: 'tool_result', tool_use_id: name, content, is_error: isError },
  })
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('task report session history', () => {
  it('persists launch facts before a tool result exists and keeps them out of runtime replay', async () => {
    const store = createStore()
    store.recordWindowUsed('session', 'turn-1', 'root-window')
    store.recordWindowUsed('session', 'turn-1', 'child-window')
    store.recordWindowUsed('session', 'turn-2', 'root-window')
    store.recordWindowUsed('other-session', 'turn-1', 'unrelated')
    await store.append('session', { type: 'turn_aborted' })

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual(['root-window', 'child-window'])
    expect((await store.read('session')).map(event => event.type)).toEqual(['turn_aborted'])
  })

  it('recovers successful launches from old root and child rollouts across compaction', async () => {
    const store = createStore()
    const launch = 'mcp_playwright__roxy_browser_launch'
    await appendTool(store, 'session', launch, {}, JSON.stringify({ browsers: [{ dirId: 'root', connected: true }] }))
    await store.append('session', { type: 'subagent_delegated', childSessionId: 'child', name: 'child', ts: 1 })
    await appendTool(store, 'child', launch, {}, JSON.stringify({ browsers: [{ dirId: 'child', connected: true }] }))
    await store.append('child', { type: 'subagent_delegated', childSessionId: 'session', name: 'cycle', ts: 2 })
    await store.append('session', { type: 'compaction', summary: 'summary', compactedCount: 2, ts: 3 })

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual(['root', 'child'])
  })

  it('does not infer usage from failed launches, unrelated tool output, or uncompleted calls', async () => {
    const store = createStore()
    const content = JSON.stringify({ browsers: [{ dirId: 'not-used', connected: true }] })
    await appendTool(store, 'session', 'mcp_playwright__roxy_browser_launch', {}, content, true)
    await appendTool(store, 'session', 'list_windows', {}, content)
    await appendTool(store, 'session', 'mcp_playwright__roxy_browser_launch', {}, 'not JSON')
    await store.append('session', {
      type: 'assistant_turn',
      items: [{
        type: 'tool_call',
        id: 'pending',
        callId: 'pending',
        name: 'mcp_playwright__roxy_browser_launch',
        arguments: { dirId: 'pending-window' },
        toolKind: 'function',
      }],
      stopReason: 'tool_use',
    })

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual([])
  })

  it('recovers used windows from accepted old reports, excluding unused or rejected entries', async () => {
    const store = createStore()
    await appendTool(store, 'session', 'roxy_task_report', {
      taskName: '历史任务',
      params: [],
      windows: [
        { dirId: 'success', success: true, failureReason: '' },
        { dirId: 'failure', success: false, failureReason: '页面失败' },
        { dirId: 'unused', success: false, status: 'unused', failureReason: '' },
      ],
    }, 'accepted')
    await appendTool(store, 'session', 'roxy_task_report', {
      taskName: '失败报告',
      params: [],
      windows: [{ dirId: 'rejected', success: true, failureReason: '' }],
    }, 'rejected', true)

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual(['success', 'failure'])
  })

  it('restores old batch script execution results without admitting unstarted targets', async () => {
    const store = createStore()
    const statuses = ['success', 'failed', 'login_required', 'timeout', 'killed', 'start_failed', 'interrupted']
    await appendTool(store, 'session', 'roxy_script_run', {
      scripts: [{ dirIds: statuses }],
    }, ['## Batch script result', ...statuses.map(status => `### Window \`${status}\`\n- status: \`${status}\``)].join('\n\n'))

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual(statuses.slice(0, 5))
  })

  it('restores an old single-window script only when its result proves execution', async () => {
    const store = createStore()
    await appendTool(store, 'session', 'roxy_script_run', {
      scripts: [{ dirIds: ['single'] }],
    }, '## Script context\n\n- status: `failed`')
    await appendTool(store, 'session', 'roxy_script_run', {
      scripts: [{ dirIds: ['not-started'] }],
    }, '## Script context\n\n- status: `start_failed`')

    expect(await readTaskReportUsedWindows(store, 'session')).toEqual(['single'])
  })
})
