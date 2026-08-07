import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, it, vi } from 'vitest'
import { recoverInterruptedConversationRuns } from '@/core/agent-events/conversationRunState'
import { ChatContextAPI, closeDatabase, ConversationManager } from './index'

const testState = vi.hoisted(() => ({ root: '' }))

vi.mock('@/config', () => ({
  env: {
    ROXY_USER_ID: 'user-1',
    ROXY_WORKSPACE_ID: 'workspace-1',
  },
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    get legacyConversationsDb() {
      return path.join(testState.root, 'state', 'legacy', 'conversations.db')
    },
    get sseCacheDir() {
      return path.join(testState.root, 'cache', 'sse')
    },
    sessionDir(conversationId: string) {
      return path.join(testState.root, 'sessions', conversationId)
    },
  },
}))

beforeAll(() => {
  testState.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversations-'))
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testState.root, { recursive: true, force: true })
})

describe('ConversationManager.update', () => {
  it('updates title state only when is_title_set is provided explicitly', () => {
    const conversationId = 'conversation-title-state'
    ConversationManager.create({
      id: conversationId,
      title: 'New Chat',
      thread_id: 'thread-title-state',
      model: 'model-a',
    })

    assert.equal(ConversationManager.getById(conversationId)?.is_title_set, 0)

    assert.equal(ConversationManager.update(conversationId, { title: 'Temporary title' }), true)
    const temporaryConversation = ConversationManager.getById(conversationId)
    assert.deepEqual(
      pickTitleState(temporaryConversation),
      { title: 'Temporary title', is_title_set: 0 },
    )
    assert.equal(temporaryConversation?.model, 'model-a')

    assert.equal(ConversationManager.update(conversationId, {
      title: 'Generated title',
      is_title_set: 1,
    }), true)
    assert.deepEqual(
      pickTitleState(ConversationManager.getById(conversationId)),
      { title: 'Generated title', is_title_set: 1 },
    )

    assert.equal(ConversationManager.update(conversationId, { title: 'Renamed title' }), true)
    assert.deepEqual(
      pickTitleState(ConversationManager.getById(conversationId)),
      { title: 'Renamed title', is_title_set: 1 },
    )

    assert.equal(ConversationManager.update(conversationId, { is_title_set: 0 }), true)
    assert.deepEqual(
      pickTitleState(ConversationManager.getById(conversationId)),
      { title: 'Renamed title', is_title_set: 0 },
    )

    assert.equal(ConversationManager.update(conversationId, { model: 'model-b' }), true)
    const updatedConversation = ConversationManager.getById(conversationId)
    assert.equal(updatedConversation?.title, 'Renamed title')
    assert.equal(updatedConversation?.model, 'model-b')
    assert.equal(updatedConversation?.is_title_set, 0)
    assert.equal(ConversationManager.update(conversationId, {}), false)
  })
})

describe('ConversationManager.create', () => {
  it('creates a visible finalized conversation without changing the active conversation', () => {
    const activeConversation = ConversationManager.create({
      id: 'active-conversation',
      title: 'Active conversation',
      thread_id: 'active-thread',
    })
    const taskConversation = ConversationManager.create({
      id: 'scheduled-task-conversation',
      title: 'Scheduled task',
      thread_id: 'scheduled-task-thread',
    }, {
      activate: false,
      isTitleSet: true,
    })

    assert.equal(activeConversation.is_active, 1)
    assert.equal(taskConversation.is_active, 0)
    assert.equal(taskConversation.is_title_set, 1)
    assert.equal(ConversationManager.getActive()?.id, activeConversation.id)
    assert.ok(ConversationManager.getAll().some(item => item.id === taskConversation.id))
  })
})

describe('conversation manager pagination', () => {
  it('returns database pages in the same stable order as the full list', () => {
    const allConversations = ConversationManager.getAll()
    const pageSize = 2
    const pagedConversationIds: string[] = []

    for (let offset = 0; offset < allConversations.length; offset += pageSize) {
      pagedConversationIds.push(...ConversationManager.getPage(pageSize, offset).map(conversation => conversation.id))
    }

    assert.deepEqual(
      pagedConversationIds,
      allConversations.map(conversation => conversation.id),
    )
    assert.deepEqual(ConversationManager.getPage(pageSize, allConversations.length), [])
  })
})

describe('ConversationManager run read state', () => {
  it('tracks the latest run and marks only that exact run as read', () => {
    const conversationId = 'conversation-read-state'
    ConversationManager.create({
      id: conversationId,
      title: 'Read state',
      thread_id: 'thread-read-state',
    })

    assert.equal(ConversationManager.startRun(conversationId, 'run-1'), true)
    assert.deepEqual(pickRunState(ConversationManager.getById(conversationId)), {
      latest_run_id: 'run-1',
      latest_run_status: 'streaming',
      last_read_run_id: null,
    })

    assert.equal(ConversationManager.finishRun(conversationId, 'run-1', 'completed'), true)
    assert.equal(ConversationManager.markRead(conversationId, 'stale-run'), false)
    assert.equal(ConversationManager.getById(conversationId)?.last_read_run_id, null)
    assert.equal(ConversationManager.markRead(conversationId, 'run-1'), true)
    assert.equal(ConversationManager.getById(conversationId)?.last_read_run_id, 'run-1')

    assert.equal(ConversationManager.startRun(conversationId, 'run-2'), true)
    assert.equal(ConversationManager.finishRun(conversationId, 'run-1', 'failed'), false)
    assert.equal(ConversationManager.finishRun(conversationId, 'run-2', 'cancelled'), true)
    assert.deepEqual(pickRunState(ConversationManager.getById(conversationId)), {
      latest_run_id: 'run-2',
      latest_run_status: 'cancelled',
      last_read_run_id: 'run-1',
    })
  })

  it('can start a new run after recovering an interrupted run', () => {
    const conversationId = 'conversation-restart-after-recovery'
    const assistantMessageId = 'assistant-interrupted'
    const runId = 'run-interrupted'
    const eventPath = path.join(testState.root, 'sessions', conversationId, 'turns', `${assistantMessageId}.jsonl`)
    const checkpointPath = path.join(testState.root, 'sessions', conversationId, 'checkpoint.db')
    fs.mkdirSync(path.dirname(eventPath), { recursive: true })
    fs.writeFileSync(eventPath, `${JSON.stringify({
      conversationId,
      runId,
      turnId: 'turn-interrupted',
      assistantMessageId,
      sequence: 1,
      timestamp: 100,
      event: {
        type: 'run_started',
        data: { source: 'user', assistantMessageId, startedAt: 100 },
      },
    })}\n`)
    fs.writeFileSync(checkpointPath, 'checkpoint-state')

    ConversationManager.create({
      id: conversationId,
      title: 'Restart after recovery',
      thread_id: 'thread-restart-after-recovery',
    })
    ChatContextAPI.addMessage({
      id: assistantMessageId,
      conversation_id: conversationId,
      role: 'assistant',
      content_type: 'file',
      storage_type: 'file',
      file_path: eventPath,
      metadata: { runId, turnId: 'turn-interrupted' },
    })
    assert.equal(ConversationManager.startRun(conversationId, runId), true)

    assert.equal(recoverInterruptedConversationRuns(ChatContextAPI, () => 200), 1)
    assert.deepEqual(pickRunState(ConversationManager.getById(conversationId)), {
      latest_run_id: runId,
      latest_run_status: 'cancelled',
      last_read_run_id: runId,
    })

    assert.equal(ConversationManager.startRun(conversationId, 'run-resumed'), true)
    assert.deepEqual(pickRunState(ConversationManager.getById(conversationId)), {
      latest_run_id: 'run-resumed',
      latest_run_status: 'streaming',
      last_read_run_id: runId,
    })
    assert.equal(ConversationManager.getById(conversationId)?.thread_id, 'thread-restart-after-recovery')
    assert.ok(fs.existsSync(eventPath))
    assert.equal(fs.readFileSync(checkpointPath, 'utf-8'), 'checkpoint-state')
  })
})

function pickTitleState(conversation: ReturnType<typeof ConversationManager.getById>) {
  return {
    title: conversation?.title,
    is_title_set: conversation?.is_title_set,
  }
}

function pickRunState(conversation: ReturnType<typeof ConversationManager.getById>) {
  return {
    latest_run_id: conversation?.latest_run_id,
    latest_run_status: conversation?.latest_run_status,
    last_read_run_id: conversation?.last_read_run_id,
  }
}

describe('conversation schema migration', () => {
  it('drops legacy task, mode, and image asset schema while preserving conversations and messages', () => {
    closeDatabase()
    const dbPath = path.join(testState.root, 'state', 'legacy', 'conversations.db')
    fs.rmSync(dbPath, { force: true })
    fs.rmSync(`${dbPath}-shm`, { force: true })
    fs.rmSync(`${dbPath}-wal`, { force: true })
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })

    const legacyDb = new DatabaseSync(dbPath)
    legacyDb.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        thread_id TEXT UNIQUE NOT NULL,
        conversation_type TEXT DEFAULT 'automation',
        workspace_path TEXT,
        model TEXT,
        is_active INTEGER DEFAULT 0,
        is_title_set INTEGER DEFAULT 0,
        is_task INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'text',
        storage_type TEXT DEFAULT 'inline',
        file_path TEXT,
        agent_mode TEXT DEFAULT 'orchestrator',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE files (
        file_id TEXT PRIMARY KEY,
        file_name TEXT,
        local_path TEXT,
        oss_url TEXT,
        remote_file_id TEXT,
        mime_type TEXT,
        size INTEGER,
        hash TEXT,
        source TEXT DEFAULT 'upload',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE assets_fts USING fts5(
        asset_id UNINDEXED,
        conversation_id UNINDEXED,
        search_text
      );
      INSERT INTO conversations (
        id, user_id, workspace_id, title, thread_id, is_active, is_title_set, is_task
      ) VALUES (
        'legacy-task-conversation', 'user-1', 'workspace-1', 'Legacy task',
        'legacy-task-thread', 0, 1, 1
      );
      INSERT INTO messages (
        id, conversation_id, role, content, content_type, storage_type, agent_mode
      ) VALUES (
        'legacy-task-message', 'legacy-task-conversation', 'assistant', 'Legacy result',
        'text', 'inline', 'orchestrator'
      );
    `)
    legacyDb.close()

    assert.ok(ConversationManager.getAll().some(item => item.id === 'legacy-task-conversation'))
    assert.equal(
      ChatContextAPI.getMessagesByConversation('legacy-task-conversation')[0]?.content,
      'Legacy result',
    )

    closeDatabase()
    const migratedDb = new DatabaseSync(dbPath)
    const columns = migratedDb.prepare('PRAGMA table_info(conversations)').all() as unknown as Array<{ name: string }>
    assert.equal(columns.some(column => column.name === 'is_task'), false)
    assert.equal(columns.some(column => column.name === 'conversation_type'), false)
    assert.equal(columns.some(column => column.name === 'latest_run_id'), true)
    assert.equal(columns.some(column => column.name === 'latest_run_status'), true)
    assert.equal(columns.some(column => column.name === 'last_read_run_id'), true)
    const messageColumns = migratedDb.prepare('PRAGMA table_info(messages)').all() as unknown as Array<{ name: string }>
    assert.equal(messageColumns.some(column => column.name === 'agent_mode'), false)
    const fileColumns = migratedDb.prepare('PRAGMA table_info(files)').all() as unknown as Array<{ name: string }>
    assert.equal(fileColumns.some(column => column.name === 'remote_file_id'), false)
    const tables = migratedDb.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").all() as unknown as Array<{ name: string }>
    assert.equal(tables.some(table => table.name === 'assets'), false)
    assert.equal(tables.some(table => table.name === 'assets_fts'), false)
    assert.equal(
      migratedDb.prepare('SELECT COUNT(*) AS count FROM conversations WHERE id = ?')
        .get('legacy-task-conversation')?.count,
      1,
    )
    migratedDb.close()
  })
})
