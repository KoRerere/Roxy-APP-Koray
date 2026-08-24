import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'vitest'
import { TaskLogStore } from './index'

describe('taskLogStore', () => {
  let tempDir: string
  let dbPath: string
  let store: TaskLogStore

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-task-logs-'))
    dbPath = path.join(tempDir, 'state', 'tasks', 'tasks.db')
    store = new TaskLogStore(dbPath)
  })

  afterEach(() => {
    store.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('is lazy and close does not create a database', () => {
    assert.equal(fs.existsSync(dbPath), false)
    store.close()
    assert.equal(fs.existsSync(dbPath), false)
  })

  it('stores lifecycle snapshots and paginates by workspace', () => {
    const events: Array<{ type: string, status?: string }> = []
    const unsubscribe = store.subscribe((event) => {
      events.push({
        type: event.type,
        status: event.type === 'changed' ? event.log.status : undefined,
      })
    })
    const created = store.create({
      id: 'log-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      taskId: 11,
      taskName: 'Daily report',
      templateId: 21,
      templateName: 'Report script',
      templateType: 'script',
      triggerType: 'cron',
      scheduledAt: '2026-07-23T01:00:00.000Z',
      input: { region: 'jp' },
      startedAt: '2026-07-23T01:00:01.000Z',
    })
    assert.equal(created.status, 'preparing')
    assert.deepEqual(created.input, { region: 'jp' })

    const running = store.markRunning('log-1', {
      occurrenceId: '2026-07-23T01:00:00.000Z',
      windowDirIds: ['window-a'],
      scriptRuns: [{
        dirId: 'window-a',
        slug: 'report-script',
        runId: 'run-a',
        fileIds: [],
      }],
    })
    assert.equal(running.status, 'running')
    assert.deepEqual(running.window_dir_ids, ['window-a'])
    assert.deepEqual(running.script_runs, [{
      dirId: 'window-a',
      slug: 'report-script',
      runId: 'run-a',
      fileIds: [],
    }])

    const finished = store.finish('log-1', {
      status: 'success',
      endedAt: '2026-07-23T01:00:05.000Z',
      scriptRuns: [{
        dirId: 'window-a',
        slug: 'report-script',
        runId: 'run-a',
        fileIds: ['file-1'],
      }],
    })
    assert.equal(finished.status, 'success')
    assert.equal(finished.conversation_id, null)
    assert.deepEqual(finished.file_ids, [])
    assert.deepEqual(finished.script_runs[0]?.fileIds, ['file-1'])

    store.create({
      id: 'other-workspace',
      userId: 'user-1',
      workspaceId: 'workspace-2',
      taskId: 11,
      taskName: 'Hidden',
      templateId: 21,
      templateName: 'Report script',
      templateType: 'script',
      triggerType: 'manual',
      input: {},
    })

    const page = store.list({ userId: 'user-1', workspaceId: 'workspace-1' })
    assert.equal(page.total, 1)
    assert.equal(page.items[0]?.id, 'log-1')

    const cronPage = store.list({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      triggerType: 'cron',
    })
    assert.equal(cronPage.total, 1)
    assert.equal(cronPage.items[0]?.id, 'log-1')

    const manualPage = store.list({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      triggerType: 'manual',
    })
    assert.equal(manualPage.total, 0)
    unsubscribe()
    assert.deepEqual(events, [
      { type: 'changed', status: 'preparing' },
      { type: 'changed', status: 'running' },
      { type: 'changed', status: 'success' },
      { type: 'changed', status: 'preparing' },
    ])
  })

  it('stores conversation and output files only for agent tasks', () => {
    store.create({
      id: 'agent-log',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      taskId: 12,
      taskName: 'Agent task',
      templateId: 22,
      templateName: 'Prompt template',
      templateType: 'prompt',
      triggerType: 'manual',
      input: 'hello',
    })
    store.markRunning('agent-log')
    store.updateAssociations('agent-log', {
      conversationId: 'conversation-1',
      fileIds: ['file-1'],
    })
    const finished = store.finish('agent-log', {
      status: 'success',
      conversationId: 'conversation-1',
      fileIds: ['file-1', 'file-2'],
      scriptRuns: [{
        dirId: 'window-a',
        slug: 'ignored-script',
        runId: 'ignored-run',
        fileIds: ['ignored-file'],
      }],
    })

    assert.equal(finished.conversation_id, 'conversation-1')
    assert.deepEqual(finished.file_ids, ['file-1', 'file-2'])
    assert.deepEqual(finished.script_runs, [])
  })

  it('creates only the new script_runs column', () => {
    store.recoverInterrupted()
    const db = new DatabaseSync(dbPath)
    const columns = db.prepare('PRAGMA table_info(task_logs)').all() as unknown as Array<{ name: string }>
    db.close()

    assert.equal(columns.some(column => column.name === 'script_runs'), true)
    assert.equal(columns.some(column => column.name === 'script_run_ids_json'), false)
    assert.equal(columns.some(column => column.name === 'end_reason'), false)
  })

  it('adds script_runs to an existing task_logs table on startup', () => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const legacyDb = new DatabaseSync(dbPath)
    legacyDb.exec(`
      CREATE TABLE task_logs (
        id                      TEXT PRIMARY KEY,
        user_id                 TEXT NOT NULL,
        workspace_id            TEXT NOT NULL,
        task_id                 INTEGER NOT NULL,
        task_name               TEXT NOT NULL,
        template_id             INTEGER NOT NULL,
        template_name           TEXT NOT NULL,
        template_type           TEXT NOT NULL,
        trigger_type            TEXT NOT NULL,
        occurrence_id           TEXT,
        scheduled_at            DATETIME,
        input_json              TEXT NOT NULL DEFAULT '{}',
        window_dir_ids_json     TEXT NOT NULL DEFAULT '[]',
        script_run_ids_json     TEXT NOT NULL DEFAULT '[]',
        conversation_id         TEXT,
        file_ids_json           TEXT NOT NULL DEFAULT '[]',
        status                  TEXT NOT NULL DEFAULT 'preparing',
        started_at              DATETIME NOT NULL,
        ended_at                DATETIME,
        end_reason_code         TEXT,
        end_reason              TEXT
      );
      INSERT INTO task_logs (
        id, user_id, workspace_id, task_id, task_name, template_id,
        template_name, template_type, trigger_type, status, started_at
      ) VALUES (
        'legacy-log', 'user-1', 'workspace-1', 11, 'Legacy task', 21,
        'Legacy script', 'script', 'manual', 'success', '2026-07-23T01:00:00.000Z'
      );
    `)
    legacyDb.close()

    assert.equal(store.recoverInterrupted(), 0)
    assert.deepEqual(store.getById('legacy-log')?.script_runs, [])

    store.close()
    store = new TaskLogStore(dbPath)
    assert.equal(store.recoverInterrupted(), 0)

    const migratedDb = new DatabaseSync(dbPath)
    const columns = migratedDb.prepare('PRAGMA table_info(task_logs)').all() as unknown as Array<{ name: string }>
    const row = migratedDb.prepare('SELECT script_runs FROM task_logs WHERE id = ?')
      .get('legacy-log') as unknown as { script_runs: string }
    migratedDb.close()

    assert.equal(columns.filter(column => column.name === 'script_runs').length, 1)
    assert.equal(row.script_runs, '[]')
  })

  it('recovers preparing and running rows without touching terminal rows', () => {
    for (const id of ['preparing', 'running', 'success']) {
      store.create({
        id,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        taskId: 11,
        taskName: id,
        templateId: 21,
        templateName: 'Template',
        templateType: 'prompt',
        triggerType: 'manual',
        input: 'hello',
      })
    }
    store.markRunning('running')
    store.finish('success', { status: 'success' })

    assert.equal(store.recoverInterrupted(), 2)
    for (const id of ['preparing', 'running']) {
      const row = store.getById(id)
      assert.equal(row?.status, 'interrupted')
      assert.equal(row?.end_reason_code, 'AGENT_RESTARTED')
    }
    assert.equal(store.getById('success')?.status, 'success')
  })

  it('deletes only terminal logs in the requested scope', () => {
    const deletedLogIds: string[] = []
    store.subscribe((event) => {
      if (event.type === 'deleted') {
        deletedLogIds.push(event.logId)
      }
    })
    for (const id of ['running', 'success', 'other-workspace']) {
      store.create({
        id,
        userId: 'user-1',
        workspaceId: id === 'other-workspace' ? 'workspace-2' : 'workspace-1',
        taskId: 11,
        taskName: id,
        templateId: 21,
        templateName: 'Template',
        templateType: 'script',
        triggerType: 'manual',
        input: {},
      })
    }
    store.markRunning('running')
    store.finish('success', { status: 'success' })
    store.finish('other-workspace', { status: 'success' })

    assert.equal(store.delete('running', 'user-1', 'workspace-1'), 'active')
    assert.equal(store.delete('success', 'user-1', 'workspace-2'), 'not_found')
    assert.equal(store.delete('success', 'user-1', 'workspace-1'), 'deleted')
    assert.deepEqual(deletedLogIds, ['success'])
    assert.equal(store.getById('success'), null)
    assert.equal(store.delete('success', 'user-1', 'workspace-1'), 'not_found')
    assert.equal(store.getById('other-workspace')?.status, 'success')
  })

  it('uses WAL and has no cross-database foreign keys', () => {
    store.recoverInterrupted()
    const db = new DatabaseSync(dbPath)
    const journal = db.prepare('PRAGMA journal_mode').get() as unknown as { journal_mode: string }
    const foreignKeys = db.prepare('PRAGMA foreign_key_list(task_logs)').all()
    db.close()
    assert.equal(journal.journal_mode.toLowerCase(), 'wal')
    assert.deepEqual(foreignKeys, [])
  })
})
