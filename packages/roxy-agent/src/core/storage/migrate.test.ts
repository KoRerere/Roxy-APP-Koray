import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createAgentPaths } from '@roxy/shared/agent-paths'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ home: '' }))

vi.mock('@/core/storage/agentPaths', async () => {
  const { createAgentPaths } = await vi.importActual<typeof import('@roxy/shared/agent-paths')>('@roxy/shared/agent-paths')
  return {
    agentPaths: new Proxy({}, {
      get(_target, property) {
        return createAgentPaths(mocks.home)[property as keyof ReturnType<typeof createAgentPaths>]
      },
    }),
  }
})

const ENV_KEYS = [
  'CHECKPOINT_DIR',
  'AGENT_WORK_DIR',
  'SKILLS_DIR',
  'DOWNLOADS_DIR',
  'ROXY_MODE',
  'AGENT_SCRIPT_PATH',
] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
}

function legacySse(): string {
  return [
    'data: {"type":"content","data":{"contentId":"answer","text":"legacy answer"},"timestamp":102}',
    '',
    'data: {"type":"done","data":{"finalAnswer":"legacy answer"},"timestamp":103}',
    '',
  ].join('\n')
}

function createLegacyDatabase(dbPath: string, assistantFilePath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  try {
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        workspace_path TEXT
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        content_type TEXT,
        storage_type TEXT,
        file_path TEXT,
        metadata TEXT,
        created_at TEXT
      );
      CREATE TABLE assets (file_id TEXT);
    `)
    db.prepare('INSERT INTO conversations (id) VALUES (?)').run('conversation-1')
    db.prepare(`
      INSERT INTO messages (
        id, conversation_id, role, content, content_type, storage_type, file_path, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'user-1',
      'conversation-1',
      'user',
      'legacy question',
      'text',
      'inline',
      null,
      JSON.stringify({ attachments: [{ fileId: 'upload-1' }] }),
      '2026-07-28 01:00:00',
    )
    db.prepare(`
      INSERT INTO messages (
        id, conversation_id, role, content, content_type, storage_type, file_path, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'assistant-1',
      'conversation-1',
      'assistant',
      '',
      'file',
      'file',
      assistantFilePath,
      JSON.stringify({ legacy: true }),
      '2026-07-28 01:00:01',
    )
  }
  finally {
    db.close()
  }
}

function readAssistant(dbPath: string): { file_path: string, content: string, metadata: string } {
  const db = new DatabaseSync(dbPath)
  try {
    return db.prepare(`
      SELECT file_path, content, metadata
      FROM messages
      WHERE id = 'assistant-1'
    `).get() as { file_path: string, content: string, metadata: string }
  }
  finally {
    db.close()
  }
}

function writeValidTarget(filePath: string): void {
  const identity = {
    conversationId: 'conversation-1',
    runId: 'legacy-run-assistant-1',
    turnId: 'user-1',
    assistantMessageId: 'assistant-1',
  }
  const events = [
    {
      ...identity,
      sequence: 1,
      timestamp: 100,
      event: {
        type: 'run_started',
        data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
      },
    },
    {
      ...identity,
      sequence: 2,
      timestamp: 101,
      event: {
        type: 'user_message',
        data: { messageId: 'user-1', content: 'legacy question', attachments: [], createdAt: 100 },
      },
    },
    {
      ...identity,
      sequence: 3,
      timestamp: 102,
      event: { type: 'run_completed', data: { finalAnswer: 'done' } },
    },
  ]
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`, 'utf-8')
}

async function loadMigration() {
  vi.resetModules()
  return import('./migrate')
}

async function waitForMigration(module: Awaited<ReturnType<typeof loadMigration>>): Promise<void> {
  await vi.waitFor(() => {
    assert.notEqual(module.getMigrationStatus().state, 'running')
  }, { timeout: 2_000 })
}

describe('conversation event storage migration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mocks.home = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-storage-migrate-'))
    for (const key of ENV_KEYS)
      delete process.env[key]
    process.env.ROXY_MODE = 'agent'
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    restoreEnv()
    fs.rmSync(mocks.home, { recursive: true, force: true })
    vi.resetModules()
  })

  it('converts an SSE message to canonical JSONL and is idempotent', async () => {
    const paths = createAgentPaths(mocks.home)
    const sourcePath = path.join(paths.sseCacheDir, 'assistant-1.sse')
    fs.mkdirSync(paths.sseCacheDir, { recursive: true })
    fs.writeFileSync(sourcePath, legacySse(), 'utf-8')
    createLegacyDatabase(paths.legacyConversationsDb, '/old/cache/sse/assistant-1.sse')
    const migration = await loadMigration()

    assert.equal(migration.migrateLegacyConversationEvents(), 1)
    const targetPath = paths.sessionTurnEvents('conversation-1', 'assistant-1')
    const events = fs.readFileSync(targetPath, 'utf-8').trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(events.map(item => item.event.type), [
      'run_started',
      'user_message',
      'content_delta',
      'run_completed',
    ])
    assert.deepEqual(events[1].event.data.attachments, [{ fileId: 'upload-1' }])
    assert.equal(fs.existsSync(sourcePath), false)
    const assistant = readAssistant(paths.legacyConversationsDb)
    assert.equal(assistant.file_path, targetPath)
    assert.equal(assistant.content, '')
    assert.deepEqual(JSON.parse(assistant.metadata), {
      legacy: true,
      source: 'conversation_run',
      format: 'jsonl',
    })
    assert.equal(migration.migrateLegacyConversationEvents(), 0)
  })

  it('does not switch the database reference when the source is missing', async () => {
    const paths = createAgentPaths(mocks.home)
    const missingPath = path.join(mocks.home, 'missing', 'assistant-1.sse')
    createLegacyDatabase(paths.legacyConversationsDb, missingPath)
    const migration = await loadMigration()

    assert.throws(
      () => migration.migrateLegacyConversationEvents(),
      /会话事件源文件缺失/,
    )
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, missingPath)
    assert.equal(fs.existsSync(paths.sessionTurnEvents('conversation-1', 'assistant-1')), false)
  })

  it('recovers an already written canonical target before changing the database reference', async () => {
    const paths = createAgentPaths(mocks.home)
    const missingPath = path.join(mocks.home, 'missing', 'assistant-1.sse')
    const targetPath = paths.sessionTurnEvents('conversation-1', 'assistant-1')
    createLegacyDatabase(paths.legacyConversationsDb, missingPath)
    writeValidTarget(targetPath)
    const migration = await loadMigration()

    assert.equal(migration.migrateLegacyConversationEvents(), 1)
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, targetPath)
    assert.equal(migration.migrateLegacyConversationEvents(), 0)
  })

  it('converts a schema v1 database directly and writes version 2 only after success', async () => {
    const paths = createAgentPaths(mocks.home)
    const sourcePath = path.join(paths.sseCacheDir, 'assistant-1.sse')
    fs.mkdirSync(paths.sseCacheDir, { recursive: true })
    fs.writeFileSync(sourcePath, legacySse(), 'utf-8')
    fs.writeFileSync(paths.versionFile, '1', 'utf-8')
    createLegacyDatabase(paths.legacyConversationsDb, sourcePath)
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    assert.equal(migration.getMigrationStatus().state, 'done')
    assert.equal(fs.readFileSync(paths.versionFile, 'utf-8'), '2')
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, paths.sessionTurnEvents('conversation-1', 'assistant-1'))
  })

  it('moves schema v0 storage before converting its SSE records', async () => {
    const paths = createAgentPaths(mocks.home)
    const oldCheckpoint = path.join(mocks.home, '..', `${path.basename(mocks.home)}-old`)
    const sourcePath = path.join(oldCheckpoint, 'sse', 'assistant-1.sse')
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true })
    fs.writeFileSync(sourcePath, legacySse(), 'utf-8')
    createLegacyDatabase(path.join(oldCheckpoint, 'conversations.db'), sourcePath)
    process.env.CHECKPOINT_DIR = oldCheckpoint
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    assert.equal(migration.getMigrationStatus().state, 'done')
    assert.equal(fs.readFileSync(paths.versionFile, 'utf-8'), '2')
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, paths.sessionTurnEvents('conversation-1', 'assistant-1'))
    assert.equal(fs.existsSync(paths.sessionTurnEvents('conversation-1', 'assistant-1')), true)
    fs.rmSync(oldCheckpoint, { recursive: true, force: true })
  })

  it('keeps schema v1 when conversion fails', async () => {
    const paths = createAgentPaths(mocks.home)
    const missingPath = path.join(mocks.home, 'missing', 'assistant-1.sse')
    fs.mkdirSync(paths.home, { recursive: true })
    fs.writeFileSync(paths.versionFile, '1', 'utf-8')
    createLegacyDatabase(paths.legacyConversationsDb, missingPath)
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    assert.equal(migration.getMigrationStatus().state, 'error')
    assert.equal(fs.readFileSync(paths.versionFile, 'utf-8'), '1')
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, missingPath)
  })
})
