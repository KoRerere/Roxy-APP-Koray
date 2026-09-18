import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDebugApi } from './debug'
import { createDownloadApi } from './download'
import { defineMetadata, defineParams } from './index'
import { createKvApi } from './kv'
import { createLlmApi } from './llm'
import { createTableApi } from './table'

const temporaryRoots: string[] = []

async function tempDir(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('sandbox API factories', () => {
  it('接受常见大截图的 Base64 数据，校验不发生栈溢出', async () => {
    // 回归：按四字符分组重复的正则在大图片上耗尽 V8 正则调用栈。
    // 修复：分开校验总长度、字符集和末尾填充，避免重复分组。
    const ask = vi.fn().mockResolvedValue('图片内容')
    const api = createLlmApi({ ask })
    await expect(api.ask('描述图片', {
      images: [{ base64: Buffer.alloc(8 * 1024 * 1024).toString('base64'), mimeType: 'image/png' }],
    })).resolves.toBe('图片内容')
    expect(ask).toHaveBeenCalledOnce()
  })

  it.each(['ask', 'json'] as const)('在 %s 调用前拒绝无效图片', async (method) => {
    const ask = vi.fn().mockResolvedValue('不应调用模型')
    const api = createLlmApi({ ask })
    for (const image of [
      { base64: '', mimeType: 'image/png' },
      { base64: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png' },
      { base64: '不是 Base64', mimeType: 'image/png' },
      { base64: 'aGVsbG8=', mimeType: 'text/plain' },
    ]) {
      const options = { images: [image] } as Parameters<typeof api.ask>[1]
      await expect(method === 'ask' ? api.ask('描述', options) : api.json('描述', {}, options)).rejects.toThrow()
    }
    expect(ask).not.toHaveBeenCalled()
  })

  it('forwards text and structured LLM requests without shared host state', async () => {
    const ask = vi.fn()
      .mockResolvedValueOnce('hello')
      .mockResolvedValueOnce({ answer: 42 })
    const api = createLlmApi({ ask })
    const signal = new AbortController().signal
    const schema = { type: 'object', properties: { answer: { type: 'number' } } }

    await expect(api.ask('prompt', { temperature: 0.1, signal })).resolves.toBe('hello')
    await expect(api.json<{ answer: number }>('structured', schema)).resolves.toEqual({ answer: 42 })
    expect(ask).toHaveBeenNthCalledWith(1, {
      prompt: 'prompt',
      options: { temperature: 0.1, signal },
    })
    expect(ask).toHaveBeenNthCalledWith(2, { prompt: 'structured', schema })
  })

  it('rejects non-text results from the script-facing LLM ask API', async () => {
    const ask = vi.fn().mockResolvedValue([{ type: 'thinking', thinking: 'private' }])
    const api = createLlmApi({ ask })

    await expect(api.ask('prompt')).rejects.toThrow(/non-text result/)
  })

  it('keeps table instances in separate storage directories', async () => {
    const firstDir = await tempDir('roxy-table-a-')
    const secondDir = await tempDir('roxy-table-b-')
    const first = new (createTableApi({ storageDir: firstDir }).Table)('records')
    const second = new (createTableApi({ storageDir: secondDir }).Table)('records')

    await first.append({ id: 'a' })
    expect(await first.all()).toEqual([{ id: 'a' }])
    expect(await second.all()).toEqual([])
    expect(await readFile(path.join(firstDir, 'records.csv'), 'utf8')).toContain('a')
    expect(await readFile(path.join(secondDir, 'records.csv'), 'utf8')).not.toContain('a')
  })

  it('replaces unsafe table name characters with hyphens before using them as file names', async () => {
    // Regression: names containing path separators or Windows-invalid characters were used directly
    // as file names, which could throw, create nested paths, or fail on some platforms.
    // Fixed by: mapping unsafe logical table name characters to '-' in a flat file name.
    const storageDir = await tempDir('roxy-table-safe-name-')
    const events: Array<{ name: string, path: string }> = []
    const table = new (createTableApi({
      storageDir,
      onChange: event => events.push({ name: event.name, path: event.path }),
    }).Table)('../客户:状态?*')

    await table.append({ id: 'a' })

    expect(table.name).toBe('../客户:状态?*')
    const entries = await readdir(storageDir, { withFileTypes: true })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.isFile()).toBe(true)
    expect(entries[0]?.name).toBe('---客户-状态--.csv')
    expect(events.at(-1)?.name).toBe('../客户:状态?*')
    expect(events.at(-1)?.path).toBe(path.join(storageDir, entries[0]!.name))
    expect(await readFile(path.join(storageDir, entries[0]!.name), 'utf8')).toContain('a')
  })

  it('keeps KV instances in separate storage directories', async () => {
    const firstDir = await tempDir('roxy-kv-a-')
    const secondDir = await tempDir('roxy-kv-b-')
    const first = new (createKvApi({ storageDir: firstDir }).KV)('state')
    const second = new (createKvApi({ storageDir: secondDir }).KV)('state')

    await first.set('run', 'a')
    expect(await first.get('run')).toBe('a')
    expect(await second.get('run')).toBeUndefined()
  })

  it('replaces unsafe KV name characters with hyphens before using them as file names', async () => {
    // Regression: unsafe logical names were interpolated into the KV JSON path directly, so names
    // with path traversal or illegal filename characters could fail before the store was usable.
    // Fixed by: mapping unsafe logical KV name characters to '-' in a flat file name.
    const storageDir = await tempDir('roxy-kv-safe-name-')
    const events: Array<{ name: string, path: string }> = []
    const store = new (createKvApi({
      storageDir,
      onChange: event => events.push({ name: event.name, path: event.path }),
    }).KV)('../客户:状态?*')

    await store.set('run', 'a')

    expect(store.name).toBe('../客户:状态?*')
    const entries = await readdir(storageDir, { withFileTypes: true })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.isFile()).toBe(true)
    expect(entries[0]?.name).toBe('---客户-状态--.kv.json')
    expect(events.at(-1)?.name).toBe('../客户:状态?*')
    expect(events.at(-1)?.path).toBe(path.join(storageDir, entries[0]!.name))
    expect(JSON.parse(await readFile(path.join(storageDir, entries[0]!.name), 'utf8'))).toEqual({ run: 'a' })
  })

  it('does not capture debug snapshots when disabled', async () => {
    const api = createDebugApi({ enabled: false })
    const page = { evaluate: vi.fn() }

    await expect(api.capturePageSnapshot(page, { label: 'before-submit' })).resolves.toEqual({ status: 'disabled' })
    expect(page.evaluate).not.toHaveBeenCalled()
  })

  it('captures a debug snapshot into the run-specific logs directory', async () => {
    const logsDir = await tempDir('roxy-debug-')
    const debug = vi.fn()
    const api = createDebugApi({ enabled: true, logsDir, debug })
    const page = {
      evaluate: vi.fn().mockResolvedValue({
        html: '<body>ok</body>',
        url: 'https://example.com',
        title: 'Example',
        capturedAt: '2026-01-01T00:00:00.000Z',
        bytes: 15,
        tooLarge: false,
        removedNodes: {},
        removedComments: 0,
      }),
    }

    const result = await api.capturePageSnapshot(page, { label: 'before-submit' })
    expect(result.status).toBe('captured')
    if (result.status !== 'captured') {
      return
    }
    expect(await readFile(result.htmlPath, 'utf8')).toBe('<body>ok</body>')
    expect(debug).toHaveBeenCalledWith(expect.stringContaining(result.htmlPath))
  })

  it('binds downloads to the output directory passed to the factory', async () => {
    const firstDir = await tempDir('roxy-download-a-')
    const secondDir = await tempDir('roxy-download-b-')
    const page = {
      evaluate: vi.fn().mockResolvedValue({
        base64: Buffer.from('hello').toString('base64'),
        bytes: 5,
        contentType: 'text/plain',
        url: 'https://example.com/file.txt',
      }),
      url: () => 'https://example.com',
    }

    const first = await createDownloadApi(firstDir).saveResource(page, 'https://example.com/file.txt', 'a.txt')
    const second = await createDownloadApi(secondDir).saveResource(page, 'https://example.com/file.txt', 'a.txt')
    expect(first.path).toBe(path.join(firstDir, 'a.txt'))
    expect(second.path).toBe(path.join(secondDir, 'a.txt'))
    expect(await readFile(first.path, 'utf8')).toBe('hello')
    expect(await readFile(second.path, 'utf8')).toBe('hello')
  })

  it('keeps metadata and params declarations as identity functions', () => {
    const metadata = { name: 'Example', slug: 'example' }
    const params = { type: 'object' as const, properties: { count: { type: 'number' } } }
    assert.equal(defineMetadata(metadata), metadata)
    assert.equal(defineParams(params), params)
  })
})
