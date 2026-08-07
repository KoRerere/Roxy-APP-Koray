import type { LibraryScript } from '@/script/libraryStore'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { LibraryStore as defaultLibraryStore } from '@/script/libraryStore'
import { assertAllowedRemoteScriptUrl } from '@/script/remoteScriptPolicy'
import { extractScriptMeta, extractScriptSelfDescription } from '@/script/scriptMeta'
import { assertSha512 } from '@/security/scriptIntegrity'

export type LibraryStoreLike = Pick<typeof defaultLibraryStore, 'get' | 'list' | 'readCode'>

export interface ResolvedReadableScriptSource {
  script: LibraryScript
  code: string
  sourceType: 'library' | 'local' | 'remote'
}

export interface ResolvedExecutableScriptSource extends ResolvedReadableScriptSource {
  scriptPath: string
  assetSlug: string
  cleanup?: () => Promise<void>
}

const MAX_REMOTE_SCRIPT_BYTES = 2 * 1024 * 1024

interface ResolveScriptSourceOptions {
  signal?: AbortSignal
  expectedSha512?: string
  fallbackAssetSlug?: string
}

export function isHttpScriptUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export function isAbsoluteLikePath(value: string): boolean {
  return value === '~'
    || value.startsWith('~/')
    || path.isAbsolute(value)
    || /^[A-Z]:[\\/]/i.test(value)
}

function expandHomePath(rawPath: string): string {
  if (rawPath === '~')
    return os.homedir()
  if (rawPath.startsWith('~/'))
    return path.join(os.homedir(), rawPath.slice(2))
  return rawPath
}

function remoteUrlToSlug(rawUrl: string): string {
  const url = new URL(rawUrl)
  const baseName = path.basename(url.pathname)
  const ext = path.extname(baseName)
  const slug = ext ? baseName.slice(0, -ext.length) : baseName
  return slug || `remote-script-${randomUUID().slice(0, 8)}`
}

function remoteUrlToFileName(rawUrl: string): string {
  const url = new URL(rawUrl)
  const baseName = path.basename(url.pathname)
  if (baseName && /\.(?:ts|js|mts|mjs)$/i.test(baseName))
    return baseName
  return 'script.ts'
}

function normalizeLocalPath(value: string): string {
  return path.resolve(expandHomePath(value))
}

function resolveByPath(value: string, store: LibraryStoreLike): LibraryScript | null {
  const normalizedInputPath = normalizeLocalPath(value)
  return store.list().find(script => path.resolve(script.scriptFile) === normalizedInputPath) ?? null
}

async function fetchRemoteScript(rawUrl: string, options: ResolveScriptSourceOptions): Promise<string> {
  assertAllowedRemoteScriptUrl(rawUrl)
  const url = new URL(rawUrl)

  const response = await fetch(url, { signal: options.signal })
  if (!response.ok)
    throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`)

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_REMOTE_SCRIPT_BYTES)
    throw new Error(`Remote script is too large: ${contentLength} bytes`)

  const data = Buffer.from(await response.arrayBuffer())
  if (data.byteLength > MAX_REMOTE_SCRIPT_BYTES)
    throw new Error(`Remote script is too large: ${data.byteLength} bytes`)

  if (options.expectedSha512)
    assertSha512(data, options.expectedSha512)

  return data.toString('utf-8')
}

export async function resolveReadableScriptSource(
  value: string,
  store: LibraryStoreLike = defaultLibraryStore,
  options: ResolveScriptSourceOptions = {},
): Promise<ResolvedReadableScriptSource> {
  if (isHttpScriptUrl(value)) {
    const code = await fetchRemoteScript(value, options)
    const meta = extractScriptMeta(code)
    return {
      script: {
        slug: remoteUrlToSlug(value),
        name: typeof meta.metadata.name === 'string' ? meta.metadata.name : remoteUrlToSlug(value),
        description: typeof meta.metadata.description === 'string' ? meta.metadata.description : undefined,
        scriptFile: value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      code,
      sourceType: 'remote',
    }
  }

  const script = resolveByPath(value, store)
  if (script) {
    const code = store.readCode(script.slug)
    if (!code)
      throw new Error(`Script code not found: ${script.slug}`)
    return { script, code, sourceType: 'library' }
  }

  const scriptFile = normalizeLocalPath(value)
  const stat = await fsPromises.stat(scriptFile).catch(() => null)
  if (!stat || !stat.isFile())
    throw new Error(`Script not found: ${value}`)

  const code = await fsPromises.readFile(scriptFile, 'utf-8')
  const slug = path.basename(scriptFile, path.extname(scriptFile)) || 'script'
  return {
    script: {
      slug,
      name: slug,
      scriptFile,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    },
    code,
    sourceType: 'local',
  }
}

function resolveAssetSlug(metadataSlug: unknown, fallback: string): string {
  return typeof metadataSlug === 'string' && metadataSlug.trim() ? metadataSlug.trim() : fallback
}

export async function resolveExecutableScriptSource(
  value: string,
  store: LibraryStoreLike = defaultLibraryStore,
  options: ResolveScriptSourceOptions = {},
): Promise<ResolvedExecutableScriptSource> {
  const source = await resolveReadableScriptSource(value, store, options)
  const extracted = extractScriptSelfDescription(source.code)
  const assetSlug = resolveAssetSlug(extracted.metadata.slug, options.fallbackAssetSlug ?? source.script.slug)

  if (source.sourceType !== 'remote') {
    return {
      ...source,
      scriptPath: source.script.scriptFile,
      assetSlug,
    }
  }

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-agent-remote-script-'))
  const scriptPath = path.join(tempDir, remoteUrlToFileName(value))
  try {
    await fsPromises.writeFile(scriptPath, source.code, 'utf-8')
  }
  catch (error) {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
    throw error
  }

  return {
    ...source,
    scriptPath,
    assetSlug,
    cleanup: async () => {
      await fsPromises.rm(tempDir, { recursive: true, force: true })
    },
  }
}
