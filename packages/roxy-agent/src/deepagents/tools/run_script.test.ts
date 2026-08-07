import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeEach, it, vi } from 'vitest'
import { AiAgentHttpError } from '@/api/errors'

const startSandboxScriptRun = vi.fn()
const getOfficialScriptBySlug = vi.fn()
const getUserTemplateById = vi.fn()
const getTemplateById = vi.fn()

vi.mock('@/services/sandboxService', () => ({
  startSandboxScriptRun,
}))

vi.mock('@/core/storage/agentPaths', async () => {
  const { createAgentPaths } = await vi.importActual<typeof import('@roxy/shared/agent-paths')>('@roxy/shared/agent-paths')
  return {
    agentPaths: createAgentPaths('/private/tmp/roxy-agent-run-script-tests'),
  }
})

vi.mock('@/api/agentApiClient', () => ({
  agentOfficialScriptsApi: {
    getBySlug: getOfficialScriptBySlug,
  },
  agentTemplatesApi: {
    getById: getTemplateById,
  },
  agentUserTemplatesApi: {
    getById: getUserTemplateById,
  },
}))

const OFFICIAL_SCRIPT_URL = 'https://roxy-web.oss-cn-beijing.aliyuncs.com/scripts/remote-script.ts'

function sha512(data: string): string {
  return createHash('sha512').update(data).digest('hex')
}

function remoteScriptResponse(code: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => String(Buffer.byteLength(code, 'utf-8')) },
    arrayBuffer: async () => Uint8Array.from(Buffer.from(code, 'utf-8')).buffer,
  }
}

function completedRun(opts: any) {
  return {
    runId: opts.runId,
    worker: { pid: 123 },
    finished: Promise.resolve({ status: 'done', exitCode: 0, artifacts: [], outputs: [] }),
    stop: () => {},
  }
}

it('resolves an official script slug, verifies SHA-512, and runs the downloaded file', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Remote script', description: 'Runs from OSS' })
defineParams({
  type: 'object',
  properties: {
    query: { type: 'string' },
  },
  required: ['query'],
})

export async function main(params) {
  console.log(params.query)
}
`
  const expectedSha512 = sha512(code)

  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-remote-script',
    ossUrl: OFFICIAL_SCRIPT_URL,
    sha512: expectedSha512,
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async (opts) => {
    const downloaded = await fsPromises.readFile(opts.scriptPath, 'utf-8')
    assert.equal(downloaded, code)
    assert.match(opts.scriptPath, /remote-script\.ts$/)
    return completedRun(opts)
  })

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official-remote-script',
    dirId: 'profile-1',
    params: { query: 'shoes' },
  })

  assert.match(result, /completed successfully/)
  assert.deepEqual(getOfficialScriptBySlug.mock.calls, [['official-remote-script']])
  assert.equal(startSandboxScriptRun.mock.calls.length, 1)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].dirId, 'profile-1')
  assert.equal(startSandboxScriptRun.mock.calls[0][0].assetSlug, 'official-remote-script')
  assert.equal(startSandboxScriptRun.mock.calls[0][0].scriptSha512, expectedSha512)
  assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, { query: 'shoes' })
})

it('passes official script defaults when params are omitted', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Defaulted remote script' })
defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string', default: 'Roxy' },
    profile: {
      type: 'object',
      properties: { retries: { type: 'integer', default: 3 } },
      required: ['retries'],
    },
  },
  required: ['keyword', 'profile'],
})

export async function main(params) {}
`

  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'defaulted-remote-script',
    ossUrl: OFFICIAL_SCRIPT_URL,
    sha512: sha512(code),
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'defaulted-remote-script',
    dirId: 'profile-1',
  })

  assert.match(result, /completed successfully/)
  assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, {
    keyword: 'Roxy',
    profile: { retries: 3 },
  })
})

it('uses defineMetadata slug for the official script asset directory', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Remote script', slug: 'shared-script-assets' })
defineParams({ type: 'object', properties: {} })

export async function main() {}
`

  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-remote-script',
    ossUrl: OFFICIAL_SCRIPT_URL,
    sha512: sha512(code),
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official-remote-script',
    dirId: 'profile-1',
  })

  assert.match(result, /completed successfully/)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].assetSlug, 'shared-script-assets')
  assert.match(startSandboxScriptRun.mock.calls[0][0].outputDir, /workdir[/\\]shared-script-assets$/)
})

it('resolves a user script template reference, verifies SHA-512, and applies saved params', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Template remote script', slug: 'template-script-assets' })
defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string' },
    limit: { type: 'number' },
  },
})

export async function main(params) {
  console.log(params.keyword, params.limit)
}
`
  const expectedSha512 = sha512(code)

  getUserTemplateById.mockResolvedValue({
    id: 73,
    templateType: 'script',
    name: 'Team script',
    description: 'Template description',
    metadata: {
      ossUrl: OFFICIAL_SCRIPT_URL,
      sha512: expectedSha512,
      params: { keyword: 'saved keyword', limit: 10 },
      optionsSchema: JSON.stringify({ type: 'object', properties: {} }),
    },
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'user:73',
    dirId: 'profile-1',
    params: { limit: 5 },
  })

  assert.match(result, /completed successfully/)
  assert.deepEqual(getUserTemplateById.mock.calls, [[73]])
  assert.equal(getTemplateById.mock.calls.length, 0)
  assert.equal(getOfficialScriptBySlug.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].scriptSha512, expectedSha512)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].assetSlug, 'template-script-assets')
  assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, { keyword: 'saved keyword', limit: 5 })
})

it('resolves an official script template reference and uses source defaults without querying the user namespace', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Official template script', slug: 'official-template-assets' })
defineParams({
  type: 'object',
  properties: { keyword: { type: 'string', default: 'source keyword' } },
})

export async function main(params) {
  console.log(params.keyword, params.limit)
}
`
  const expectedSha512 = sha512(code)

  getTemplateById.mockResolvedValue({
    id: 88,
    slug: 'official-template-88',
    templateType: 'script',
    name: { zh: '官方模板脚本', en: 'Official template script' },
    description: { zh: '直接运行官方模板', en: 'Run the official template directly' },
    metadata: {
      ossUrl: OFFICIAL_SCRIPT_URL,
      sha512: expectedSha512,
      params: { keyword: 'saved keyword', limit: 10 },
      optionsSchema: JSON.stringify({ type: 'object', properties: {} }),
    },
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official:88',
    dirId: 'profile-1',
    params: { limit: 5 },
  })

  assert.match(result, /completed successfully/)
  assert.deepEqual(getUserTemplateById.mock.calls, [])
  assert.deepEqual(getTemplateById.mock.calls, [[88]])
  assert.equal(getOfficialScriptBySlug.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].scriptSha512, expectedSha512)
  assert.equal(startSandboxScriptRun.mock.calls[0][0].assetSlug, 'official-template-assets')
  assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, { keyword: 'source keyword', limit: 5 })
})

it('parses defaults from an official template script when template params are omitted', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Official default template' })
defineParams({
  type: 'object',
  properties: { keyword: { type: 'string', default: '官方默认' } },
  required: ['keyword'],
})

export async function main(params) {}
`

  getTemplateById.mockResolvedValue({
    id: 89,
    slug: 'official-default-template',
    templateType: 'script',
    name: '官方默认模板',
    metadata: {
      ossUrl: OFFICIAL_SCRIPT_URL,
      sha512: sha512(code),
      optionsSchema: JSON.stringify({
        type: 'object',
        properties: { keyword: { type: 'string', default: 'metadata default' } },
        required: ['keyword'],
      }),
    },
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official:89',
    dirId: 'profile-1',
  })

  assert.match(result, /completed successfully/)
  assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, { keyword: '官方默认' })
})

it('uses user template metadata params directly and reports missing required values before starting', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'User template' })
defineParams({ type: 'object', properties: { keyword: { type: 'string' } }, required: ['keyword'] })

export async function main(params) {}
`

  getUserTemplateById.mockResolvedValue({
    id: 74,
    templateType: 'script',
    name: '用户模板',
    metadata: {
      ossUrl: OFFICIAL_SCRIPT_URL,
      sha512: sha512(code),
      params: {},
      optionsSchema: JSON.stringify({
        type: 'object',
        properties: { keyword: { type: 'string' } },
        required: ['keyword'],
      }),
    },
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'user:74',
    dirId: 'profile-1',
  })

  assert.match(result, /## Script parameters required/)
  assert.match(result, /`keyword`/)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('does not query an official template when resolving a user template fails', async () => {
  getUserTemplateById.mockRejectedValue(new AiAgentHttpError(503, 'Service unavailable'))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'user:88',
    dirId: 'profile-1',
  })

  assert.match(result, /Failed to fetch template user:88/)
  assert.equal(getTemplateById.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('rejects a non-script official template reference', async () => {
  getTemplateById.mockResolvedValue({
    id: 88,
    slug: 'official-skill-88',
    templateType: 'skill',
    name: 'Official Skill',
    metadata: {},
  })

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official:88',
    dirId: 'profile-1',
  })

  assert.match(result, /is skill, not script/)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it.each([
  ['OSS URL', { sha512: 'a'.repeat(128) }],
  ['SHA-512', { ossUrl: OFFICIAL_SCRIPT_URL }],
])('rejects an official template reference when %s is missing', async (field, metadata) => {
  getTemplateById.mockResolvedValue({
    id: 88,
    slug: 'official-template-88',
    templateType: 'script',
    name: 'Official Script',
    metadata,
  })

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official:88',
    dirId: 'profile-1',
  })

  assert.match(result, new RegExp(`missing ${field}`))
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('rejects a bare numeric template id without querying either namespace', async () => {
  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: '88',
    dirId: 'profile-1',
  })

  assert.match(result, /Invalid template reference/)
  assert.equal(getUserTemplateById.mock.calls.length, 0)
  assert.equal(getTemplateById.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('rejects an official script when the downloaded bytes do not match SHA-512', async () => {
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Tampered script' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`

  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-tampered-script',
    ossUrl: OFFICIAL_SCRIPT_URL,
    sha512: '0'.repeat(128),
  })
  vi.stubGlobal('fetch', vi.fn(async () => remoteScriptResponse(code)))

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official-tampered-script',
    dirId: 'profile-1',
  })

  assert.match(result, /Failed to resolve script/)
  assert.match(result, /SHA-512 mismatch/)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('rejects an official script whose detail is missing integrity metadata', async () => {
  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-no-hash',
    ossUrl: OFFICIAL_SCRIPT_URL,
    sha512: null,
  })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official-no-hash',
    dirId: 'profile-1',
  })

  assert.match(result, /missing SHA-512/)
  assert.equal(fetchMock.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('rejects an official script whose detail is missing an OSS URL', async () => {
  getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-no-url',
    ossUrl: null,
    sha512: '0'.repeat(128),
  })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: 'official-no-url',
    dirId: 'profile-1',
  })

  assert.match(result, /missing OSS URL/)
  assert.equal(fetchMock.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

it('runs an absolute local script without fetching details or checking SHA-512', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-local-test-'))
  const scriptPath = path.join(tempDir, 'local-script.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Local script', slug: 'local-assets' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`
  await fsPromises.writeFile(scriptPath, code, 'utf-8')
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
    const result = await tool.invoke({ scriptPath, dirId: 'profile-1' })

    assert.match(result, /completed successfully/)
    assert.equal(getOfficialScriptBySlug.mock.calls.length, 0)
    assert.equal(fetchMock.mock.calls.length, 0)
    assert.equal(startSandboxScriptRun.mock.calls[0][0].scriptPath, scriptPath)
    assert.equal(startSandboxScriptRun.mock.calls[0][0].scriptSha512, undefined)
    assert.equal(startSandboxScriptRun.mock.calls[0][0].assetSlug, 'local-assets')
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('passes local script defaults when params are omitted', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-local-defaults-test-'))
  const scriptPath = path.join(tempDir, 'local-defaults.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Local defaults', slug: 'local-defaults-assets' })
defineParams({
  type: 'object',
  properties: { count: { type: 'integer', default: 2 } },
  required: ['count'],
})
export async function main(options) {}
`
  await fsPromises.writeFile(scriptPath, code, 'utf-8')
  startSandboxScriptRun.mockImplementation(async opts => completedRun(opts))

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
    const result = await tool.invoke({ scriptPath, dirId: 'profile-1' })

    assert.match(result, /completed successfully/)
    assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].options, { count: 2 })
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('publishes sandbox logs as canonical script output events through the run writer', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-events-test-'))
  const scriptPath = path.join(tempDir, 'local-script.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Local event script', slug: 'local-event-assets' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`
  await fsPromises.writeFile(scriptPath, code, 'utf-8')
  startSandboxScriptRun.mockImplementation(async (opts) => {
    opts.onLog?.({ level: 'info', message: 'processing row 1', runId: opts.runId })
    return completedRun(opts)
  })
  const writer = vi.fn()

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({
      defaultDirId: 'profile-1',
      taskMonitorTaskId: 'task-monitor-1',
    })
    await tool.invoke({ scriptPath, dirId: 'profile-1' }, {
      toolCall: { id: 'tool-run-script-1' },
      configurable: { taskMonitorTaskId: 'nested-task-monitor' },
      taskMonitorTaskId: 'legacy-task-monitor',
      writer,
    } as any)

    assert.deepEqual(writer.mock.calls, [[{
      type: 'script_output',
      data: {
        scriptName: scriptPath,
        level: 'info',
        message: 'processing row 1',
        toolId: 'tool-run-script-1',
        scriptRunId: startSandboxScriptRun.mock.calls[0][0].runId,
        workerId: undefined,
      },
    }]])
    assert.deepEqual(startSandboxScriptRun.mock.calls[0][0].taskMonitor, {
      taskId: 'task-monitor-1',
      browserId: 'profile-1',
      label: 'profile-1',
      input: { scriptPath, dirId: 'profile-1', debug: false },
    })
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('returns a complete small script log directly to the agent', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-inline-log-test-'))
  const scriptPath = path.join(tempDir, 'local-script.ts')
  await fsPromises.writeFile(scriptPath, `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Inline log script', slug: 'inline-log-assets' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`, 'utf-8')
  startSandboxScriptRun.mockImplementation(async (opts) => {
    await fsPromises.writeFile(opts.logFilePath, 'processed 3 rows\n', 'utf-8')
    return completedRun(opts)
  })

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
    const result = await tool.invoke({ scriptPath, dirId: 'profile-1' })

    assert.match(result, /## Log output/)
    assert.match(result, /Complete log \(17 bytes; inline limit: 8192 bytes\)/)
    assert.match(result, /processed 3 rows/)
    assert.doesNotMatch(result, /## Log file/)
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('returns the log path when UTF-8 log bytes exceed the inline threshold', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-large-log-test-'))
  const scriptPath = path.join(tempDir, 'local-script.ts')
  await fsPromises.writeFile(scriptPath, `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Large log script', slug: 'large-log-assets' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`, 'utf-8')
  startSandboxScriptRun.mockImplementation(async (opts) => {
    await fsPromises.writeFile(opts.logFilePath, '你好', 'utf-8')
    return completedRun(opts)
  })

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({ defaultDirId: 'profile-1', inlineLogMaxBytes: 5 })
    const result = await tool.invoke({ scriptPath, dirId: 'profile-1' })

    assert.match(result, /## Log file/)
    assert.match(result, /Log content was not inlined because it is 6 bytes \(inline limit: 5 bytes\)/)
    assert.doesNotMatch(result, /## Log output/)
    assert.doesNotMatch(result, /你好/)
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('records user-facing sandbox outputs in the agent file collector', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-outputs-test-'))
  const scriptPath = path.join(tempDir, 'local-script.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Local script', slug: 'local-assets' })
defineParams({ type: 'object', properties: {} })
export async function main() {}
`
  await fsPromises.writeFile(scriptPath, code, 'utf-8')
  const collected: any[] = []
  let tablePath = ''
  let kvPath = ''
  let artifactLogPath = ''
  startSandboxScriptRun.mockImplementation(async (opts) => {
    tablePath = path.join(opts.outputDir, 'rows.csv')
    kvPath = path.join(opts.outputDir, 'state.kv.json')
    artifactLogPath = path.join(opts.outputDir, 'artifact-run.log')
    return {
      ...completedRun(opts),
      finished: Promise.resolve({
        status: 'done',
        exitCode: 0,
        artifacts: [
          { fileName: 'rows.csv', localPath: tablePath, size: 5, relPath: 'rows.csv', changeType: 'created' },
          { fileName: 'artifact-run.log', localPath: artifactLogPath, size: 5, relPath: 'artifact-run.log', changeType: 'created' },
        ],
        outputs: [
          { type: 'log', path: path.join(opts.outputDir, 'logs', '2026-07-17', 'run.log'), changeType: 'created' },
          {
            type: 'kv',
            path: kvPath,
            changeType: 'modified',
            operations: [
              { action: 'set', count: 2 },
              { action: 'delete', count: 1 },
            ],
          },
          {
            type: 'table',
            path: tablePath,
            changeType: 'created',
            operations: [{ action: 'append', count: 1, rowCount: 3 }],
          },
        ],
      }),
    }
  })

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({
      defaultDirId: 'profile-1',
      fileCollector: {
        record: file => collected.push(file),
        consume: () => [],
        peek: () => collected,
      },
    })

    const result = await tool.invoke({ scriptPath, dirId: 'profile-1' })

    assert.match(result, /completed successfully/)
    assert.match(result, /## Files changed/)
    assert.match(result, /### Created/)
    assert.match(result, /### Modified/)
    assert.match(result, /`kv` \[state\.kv\.json\]/)
    assert.match(result, /set x2, delete x1/)
    assert.match(result, /append x1 \(3 rows\)/)
    assert.doesNotMatch(result, /run\.log/)
    assert.doesNotMatch(result, /artifact-run\.log/)
    assert.deepEqual(
      collected.map(file => ({ virtualPath: file.virtualPath, realPath: file.realPath, op: file.op })),
      [
        { virtualPath: '/workdir/local-assets/rows.csv', realPath: tablePath, op: 'write' },
      ],
    )
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('reports LoginRequired as a failed run and tells the agent which window needs login', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'run-script-login-required-'))
  const scriptPath = path.join(tempDir, 'login-script.ts')
  await fsPromises.writeFile(scriptPath, `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
defineMetadata({ name: 'Login script', slug: 'login-script' })
defineParams({ type: 'object', properties: {} })
export async function main(): Promise<string | void> {
  return 'LoginRequired'
}
`, 'utf-8')
  startSandboxScriptRun.mockImplementation(async opts => ({
    ...completedRun(opts),
    finished: Promise.resolve({
      status: 'failed',
      exitCode: 0,
      returnValue: 'LoginRequired',
      artifacts: [],
      outputs: [],
    }),
  }))

  try {
    const { createRunScriptTool } = await import('./run_script')
    const tool = createRunScriptTool({
      defaultDirId: 'profile-login',
      scriptOutputDir: tempDir,
      scriptLogsDir: tempDir,
    })
    const result = await tool.invoke({ scriptPath, dirId: 'profile-login' })

    assert.match(result, /failed because target website requires login/)
    assert.match(result, /Script return value: `LoginRequired`/)
    assert.match(result, /Ask the user to log in/)
    assert.doesNotMatch(result, /completed successfully/)
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('rejects a direct remote script URL so integrity checks cannot be bypassed', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  const { createRunScriptTool } = await import('./run_script')
  const tool = createRunScriptTool({ defaultDirId: 'profile-1' })
  const result = await tool.invoke({
    scriptPath: OFFICIAL_SCRIPT_URL,
    dirId: 'profile-1',
  })

  assert.match(result, /Pass a canonical template reference or official script slug instead/)
  assert.equal(getOfficialScriptBySlug.mock.calls.length, 0)
  assert.equal(fetchMock.mock.calls.length, 0)
  assert.equal(startSandboxScriptRun.mock.calls.length, 0)
})

beforeEach(() => {
  startSandboxScriptRun.mockReset()
  getOfficialScriptBySlug.mockReset()
  getUserTemplateById.mockReset()
  getTemplateById.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await fsPromises.rm('/private/tmp/roxy-agent-run-script-tests', { recursive: true, force: true })
})
