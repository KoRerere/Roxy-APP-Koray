import { createAgentPaths } from '@roxy/shared/agent-paths'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { InMemoryProvider, replayIntoMemory } from 'roxy-agent-runtime'
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
    if (value === undefined) {
      delete process.env[key]
    }
    else {
      process.env[key] = value
    }
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
  const events: Array<Record<string, unknown>> = [
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

function writeTurn(filePath: string, input: {
  conversationId?: string
  timestamp: number
  question: string
  answer?: string
  thinking?: string
  toolName?: string
}): void {
  const conversationId = input.conversationId ?? 'conversation-1'
  const identity = {
    conversationId,
    runId: `run-${input.timestamp}`,
    turnId: `turn-${input.timestamp}`,
    assistantMessageId: path.basename(filePath, '.jsonl'),
  }
  const events: Array<Record<string, unknown>> = [
    {
      ...identity,
      sequence: 1,
      timestamp: input.timestamp,
      event: { type: 'run_started', data: { source: 'user', assistantMessageId: identity.assistantMessageId, startedAt: input.timestamp } },
    },
    {
      ...identity,
      sequence: 2,
      timestamp: input.timestamp + 1,
      event: { type: 'user_message', data: { messageId: identity.turnId, content: input.question, attachments: [], createdAt: input.timestamp + 1 } },
    },
    ...(input.thinking
      ? [{
          ...identity,
          sequence: 3,
          timestamp: input.timestamp + 2,
          event: { type: 'thinking_delta', data: { thinkingId: `thinking-${input.timestamp}`, text: input.thinking } },
        }]
      : []),
    ...(input.toolName
      ? [{
          ...identity,
          sequence: input.thinking ? 4 : 3,
          timestamp: input.timestamp + 3,
          event: { type: 'tool_finished', data: { toolName: input.toolName, toolId: `tool-${input.timestamp}`, output: 'tool output', status: 'success' } },
        }]
      : []),
    ...(input.answer
      ? [{
          ...identity,
          sequence: 3 + Number(Boolean(input.thinking)) + Number(Boolean(input.toolName)),
          timestamp: input.timestamp + 4,
          event: { type: 'content_delta', data: { contentId: `content-${input.timestamp}`, text: input.answer } },
        }]
      : []),
  ]
  events.push({
    ...identity,
    sequence: events.length + 1,
    timestamp: input.timestamp + 5,
    event: { type: 'run_completed', data: {} },
  })
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

async function waitForRollout(filePath: string): Promise<void> {
  await vi.waitFor(() => {
    assert.equal(fs.existsSync(filePath), true)
  }, { timeout: 2_000 })
}

async function waitForVersion(filePath: string, version: string): Promise<void> {
  await vi.waitFor(() => {
    assert.equal(fs.readFileSync(filePath, 'utf-8'), version)
  }, { timeout: 2_000 })
}

function findMigrationLogs(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }
  const result: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...findMigrationLogs(filePath))
    }
    else if (entry.isFile() && entry.name.startsWith('migration-') && entry.name.endsWith('.log')) {
      result.push(filePath)
    }
  }
  return result
}

describe('conversation event storage migration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mocks.home = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-storage-migrate-'))
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
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

  it('skips a missing SSE source without switching the database reference', async () => {
    const paths = createAgentPaths(mocks.home)
    const missingPath = path.join(mocks.home, 'missing', 'assistant-1.sse')
    createLegacyDatabase(paths.legacyConversationsDb, missingPath)
    const migration = await loadMigration()

    assert.equal(migration.migrateLegacyConversationEvents(), 0)
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

  it('converts a schema v1 database directly and writes version 4', async () => {
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
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, paths.sessionTurnEvents('conversation-1', 'assistant-1'))
    await waitForRollout(paths.sessionRollout('conversation-1'))
    await waitForVersion(paths.versionFile, '4')
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
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, paths.sessionTurnEvents('conversation-1', 'assistant-1'))
    await waitForRollout(paths.sessionRollout('conversation-1'))
    await waitForVersion(paths.versionFile, '4')
    assert.equal(fs.existsSync(path.dirname(paths.sessionTurnEvents('conversation-1', 'assistant-1'))), false)
    fs.rmSync(oldCheckpoint, { recursive: true, force: true })
  })

  it('finishes schema v4 when a legacy conversion cannot be recovered', async () => {
    const paths = createAgentPaths(mocks.home)
    const missingPath = path.join(mocks.home, 'missing', 'assistant-1.sse')
    fs.mkdirSync(paths.home, { recursive: true })
    fs.writeFileSync(paths.versionFile, '1', 'utf-8')
    createLegacyDatabase(paths.legacyConversationsDb, missingPath)
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    assert.equal(migration.getMigrationStatus().state, 'done')
    await waitForVersion(paths.versionFile, '4')
    assert.equal(readAssistant(paths.legacyConversationsDb).file_path, missingPath)
  })

  it('upgrades schema v2 and backfills rollout in the background', async () => {
    const paths = createAgentPaths(mocks.home)
    fs.writeFileSync(paths.versionFile, '2', 'utf-8')
    writeTurn(paths.sessionTurnEvents('conversation-1', 'msg_200_turn'), {
      timestamp: 200,
      question: 'from v2',
      answer: 'v2 answer',
    })
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    await waitForRollout(paths.sessionRollout('conversation-1'))
    await waitForVersion(paths.versionFile, '4')
  })

  it('upgrades schema v3 and runs the legacy session cleanup', async () => {
    const paths = createAgentPaths(mocks.home)
    fs.writeFileSync(paths.versionFile, '3', 'utf-8')
    writeTurn(paths.sessionTurnEvents('conversation-1', 'msg_300_turn'), {
      timestamp: 300,
      question: 'retry me',
      answer: 'retried answer',
    })
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    await waitForRollout(paths.sessionRollout('conversation-1'))
    await waitForVersion(paths.versionFile, '4')
    assert.equal(fs.existsSync(path.dirname(paths.sessionTurnEvents('conversation-1', 'msg_300_turn'))), false)
  })

  it('does not run legacy session migration when storage is already schema v4', async () => {
    const paths = createAgentPaths(mocks.home)
    fs.writeFileSync(paths.versionFile, '4', 'utf-8')
    writeTurn(paths.sessionTurnEvents('conversation-1', 'msg_400_turn'), {
      timestamp: 400,
      question: 'do not retry me',
      answer: 'must remain untouched',
    })
    const migration = await loadMigration()

    migration.runStorageMigration()
    assert.equal(migration.getMigrationStatus().state, 'done')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(fs.existsSync(paths.sessionRollout('conversation-1')), false)
    assert.equal(fs.existsSync(path.dirname(paths.sessionTurnEvents('conversation-1', 'msg_400_turn'))), true)
  })

  it('skips current schema migration when compatibility dirs point at the agent package', async () => {
    const paths = createAgentPaths(mocks.home)
    fs.writeFileSync(paths.versionFile, '4', 'utf-8')
    const packageDir = path.join(mocks.home, 'agent-bin')
    fs.mkdirSync(packageDir, { recursive: true })
    fs.writeFileSync(path.join(packageDir, 'roxy-agent.mjs'), '', 'utf-8')
    process.env.AGENT_SCRIPT_PATH = path.join(packageDir, 'roxy-agent.mjs')
    process.env.AGENT_WORK_DIR = packageDir
    process.env.SKILLS_DIR = packageDir
    writeTurn(paths.sessionTurnEvents('conversation-1', 'msg_401_turn'), {
      timestamp: 401,
      question: 'do not cleanup me',
      answer: 'must remain untouched',
    })
    const migration = await loadMigration()

    migration.runStorageMigration()
    assert.equal(migration.getMigrationStatus().state, 'done')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(fs.existsSync(paths.sessionRollout('conversation-1')), false)
    assert.equal(fs.existsSync(path.dirname(paths.sessionTurnEvents('conversation-1', 'msg_401_turn'))), true)
  })

  it('continues migration when version is current but legacy layout still exists', async () => {
    const paths = createAgentPaths(mocks.home)
    fs.writeFileSync(paths.versionFile, '4', 'utf-8')
    fs.mkdirSync(process.env.CHECKPOINT_DIR = path.join(mocks.home, 'legacy-checkpoint'), { recursive: true })
    writeTurn(paths.sessionTurnEvents('conversation-1', 'msg_401_turn'), {
      timestamp: 401,
      question: 'cleanup me',
      answer: 'cleanup answer',
    })
    const migration = await loadMigration()

    migration.runStorageMigration()
    await waitForMigration(migration)
    await waitForRollout(paths.sessionRollout('conversation-1'))
    assert.equal(migration.getMigrationStatus().state, 'done')
    assert.deepEqual(findMigrationLogs(paths.logsDir), [])
  })

  it('builds a provider-neutral rollout from ordered turn files without thinking', async () => {
    const paths = createAgentPaths(mocks.home)
    const turnsDir = path.dirname(paths.sessionTurnEvents('conversation-1', 'assistant-1'))
    writeTurn(path.join(turnsDir, 'later.jsonl'), {
      timestamp: 200,
      question: 'second question',
      answer: 'second answer',
      thinking: 'private second reasoning',
    })
    writeTurn(path.join(turnsDir, 'earlier.jsonl'), {
      timestamp: 100,
      question: 'first question',
      answer: 'first answer',
      thinking: 'private first reasoning',
      toolName: 'roxy_browser_launch',
    })
    const checkpointFiles = [
      paths.sessionCheckpointDb('conversation-1'),
      `${paths.sessionCheckpointDb('conversation-1')}-shm`,
      `${paths.sessionCheckpointDb('conversation-1')}-wal`,
    ]
    for (const file of checkpointFiles) {
      fs.writeFileSync(file, 'legacy checkpoint', 'utf-8')
    }
    const migration = await loadMigration()

    assert.equal(await migration.migrateLegacyTurnsToRollouts(), 1)
    const rollout = fs.readFileSync(paths.sessionRollout('conversation-1'), 'utf-8').trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(rollout.map(event => event.type), [
      'session_start',
      'user_input',
      'assistant_turn',
      'turn_completed',
      'user_input',
      'assistant_turn',
      'turn_completed',
    ])
    assert.deepEqual(rollout.filter(event => event.type === 'user_input').map(event => event.message.content), [
      'first question',
      'second question',
    ])
    assert.equal(JSON.stringify(rollout).includes('private first reasoning'), false)
    assert.equal(JSON.stringify(rollout).includes('private second reasoning'), false)
    assert.equal(JSON.stringify(rollout).includes('reasoning'), false)

    const memory = new InMemoryProvider()
    await replayIntoMemory({
      append: async () => {},
      read: async () => rollout,
      list: async () => [],
      meta: async () => null,
    }, memory, 'conversation-1')
    const history = await memory.getAll('conversation-1')
    assert.deepEqual(history.map(message => message.role), ['user', 'assistant', 'user', 'assistant'])
    assert.equal(JSON.stringify(history).includes('private first reasoning'), false)
    assert.equal(fs.existsSync(turnsDir), false)
    for (const file of checkpointFiles) {
      assert.equal(fs.existsSync(file), false)
    }
  })

  it('skips broken turns and preserves an existing rollout', async () => {
    const paths = createAgentPaths(mocks.home)
    const turnsDir = path.dirname(paths.sessionTurnEvents('conversation-1', 'assistant-1'))
    fs.mkdirSync(turnsDir, { recursive: true })
    fs.writeFileSync(path.join(turnsDir, 'broken.jsonl'), '{not json}\n', 'utf-8')
    writeTurn(path.join(turnsDir, 'valid.jsonl'), {
      timestamp: 100,
      question: 'recover me',
      toolName: 'roxy_browser_launch',
    })
    const migration = await loadMigration()

    assert.equal(await migration.migrateLegacyTurnsToRollouts(), 1)
    const generated = fs.readFileSync(paths.sessionRollout('conversation-1'), 'utf-8')
    assert.match(generated, /recover me/)
    assert.match(generated, /roxy_browser_launch/)

    fs.mkdirSync(turnsDir, { recursive: true })
    writeTurn(path.join(turnsDir, 'leftover.jsonl'), {
      timestamp: 200,
      question: 'must not overwrite',
      answer: 'ignored',
    })
    for (const suffix of ['', '-shm', '-wal']) {
      fs.writeFileSync(`${paths.sessionCheckpointDb('conversation-1')}${suffix}`, 'legacy checkpoint', 'utf-8')
    }
    fs.writeFileSync(paths.sessionRollout('conversation-1'), 'already exists\n', 'utf-8')
    assert.equal(await migration.migrateLegacyTurnsToRollouts(), 0)
    assert.equal(fs.readFileSync(paths.sessionRollout('conversation-1'), 'utf-8'), 'already exists\n')
    assert.equal(fs.existsSync(turnsDir), false)
    for (const suffix of ['', '-shm', '-wal']) {
      assert.equal(fs.existsSync(`${paths.sessionCheckpointDb('conversation-1')}${suffix}`), false)
    }
  })

  it('migrates the most recently updated session first', async () => {
    const paths = createAgentPaths(mocks.home)
    const olderTurn = paths.sessionTurnEvents('older-conversation', 'older-turn')
    const newerTurn = paths.sessionTurnEvents('newer-conversation', 'newer-turn')
    writeTurn(olderTurn, {
      conversationId: 'older-conversation',
      timestamp: 100,
      question: 'older',
      answer: 'older answer',
    })
    writeTurn(newerTurn, {
      conversationId: 'newer-conversation',
      timestamp: 200,
      question: 'newer',
      answer: 'newer answer',
    })
    const olderDate = new Date('2026-01-01T00:00:00Z')
    const newerDate = new Date('2026-02-01T00:00:00Z')
    fs.utimesSync(olderTurn, olderDate, olderDate)
    fs.utimesSync(newerTurn, newerDate, newerDate)
    const migration = await loadMigration()
    const lines: string[] = []

    assert.equal(await migration.migrateLegacyTurnsToRollouts(lines), 2)
    const completed = lines.filter(line => line.includes('已补迁历史 rollout'))
    assert.match(completed[0] ?? '', /newer-conversation/)
    assert.match(completed[1] ?? '', /older-conversation/)
  })

  it('removes orphaned checkpoint sidecars without requiring turns', async () => {
    const paths = createAgentPaths(mocks.home)
    const checkpoint = paths.sessionCheckpointDb('checkpoint-only')
    for (const suffix of ['', '-shm', '-wal']) {
      fs.mkdirSync(path.dirname(checkpoint), { recursive: true })
      fs.writeFileSync(`${checkpoint}${suffix}`, 'legacy checkpoint', 'utf-8')
    }
    const migration = await loadMigration()

    assert.equal(await migration.migrateLegacyTurnsToRollouts(), 0)
    for (const suffix of ['', '-shm', '-wal']) {
      assert.equal(fs.existsSync(`${checkpoint}${suffix}`), false)
    }
  })

  it('keeps unrecoverable turns while removing their checkpoint files', async () => {
    const paths = createAgentPaths(mocks.home)
    const turnsDir = path.dirname(paths.sessionTurnEvents('broken-conversation', 'broken-turn'))
    fs.mkdirSync(turnsDir, { recursive: true })
    fs.writeFileSync(path.join(turnsDir, 'broken.jsonl'), '{not json}\n', 'utf-8')
    const checkpoint = paths.sessionCheckpointDb('broken-conversation')
    for (const suffix of ['', '-shm', '-wal']) {
      fs.writeFileSync(`${checkpoint}${suffix}`, 'legacy checkpoint', 'utf-8')
    }
    const migration = await loadMigration()

    assert.equal(await migration.migrateLegacyTurnsToRollouts(), 0)
    assert.equal(fs.existsSync(turnsDir), true)
    for (const suffix of ['', '-shm', '-wal']) {
      assert.equal(fs.existsSync(`${checkpoint}${suffix}`), false)
    }
  })
})
