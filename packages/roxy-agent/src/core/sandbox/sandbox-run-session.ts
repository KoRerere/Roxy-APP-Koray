import type { SandboxHostRunResult, SandboxHostToAgentMessage, SandboxRunPayload, SandboxRunPhase } from './host-protocol'
import type { AskRequest } from '@/modes/sandbox-api/llm'
import buffer, { Buffer } from 'node:buffer'
import crypto, { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import fsPromises from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'
import stream from 'node:stream'
import url from 'node:url'
import vm from 'node:vm'
import * as sbRoot from '@/modes/sandbox-api'
import { createDebugApi } from '@/modes/sandbox-api/debug'
import { createDownloadApi } from '@/modes/sandbox-api/download'
import * as sbHuman from '@/modes/sandbox-api/human'
import { createKvApi } from '@/modes/sandbox-api/kv'
import { createLlmApi, llmSerializableOptionsSchema } from '@/modes/sandbox-api/llm'
import { createTableApi } from '@/modes/sandbox-api/table'
import * as sb2fa from '@/modes/sandbox-api/twoFactor'
import * as sbUtils from '@/modes/sandbox-api/utils'
import { assertSha512 } from '@/security/scriptIntegrity'
import { assertFetchAllowed, parseScriptPermissions } from '@/security/scriptPermissions'
import { createSandboxFsModules } from './sandbox-fs'
import { createSandboxPlaywrightFacade } from './sandbox-playwright'
import { buildSandboxProcess, createRuntimeContext } from './sandbox-runtime'
import { createSandboxTimers } from './sandbox-timers'
import { executeSandboxScriptEntry } from './script-entry'

export type SandboxRunState = 'created' | 'running' | 'aborting' | 'finished' | 'disposed'

export type SandboxRunSessionEvent
  = | { type: 'log', level: string, message: string }
    | { type: 'llm.request', requestId: string, request: Extract<SandboxHostToAgentMessage, { type: 'rpc.llm.request' }>['request'] }
    | { type: 'phase', phase: SandboxRunPhase, timestamp: number }

export interface SandboxRunSessionOptions {
  runId: string
  payload: SandboxRunPayload
  emit: (event: SandboxRunSessionEvent) => void
}

interface StorageOperation {
  action: string
  count: number
  rowCount?: number
}

interface StorageAccumulator {
  type: 'kv' | 'table'
  path: string
  name: string
  counts: Map<string, number>
  rowCounts: Map<string, number>
}

class SandboxProcessExit extends Error {
  constructor(readonly code: number) {
    super(`Sandbox process exited with code ${code}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ? `${error.message}\nstack: ${error.stack}` : error.message
  }
  return errorMessage(error)
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }
  return new Error(typeof reason === 'string' ? reason : 'Sandbox run aborted')
}

const SCRIPT_BROWSER_OUTPUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function cleanOldBrowserDirs(browserOutputDir: string): Promise<void> {
  const root = path.dirname(browserOutputDir)
  const cutoff = Date.now() - SCRIPT_BROWSER_OUTPUT_MAX_AGE_MS
  const entries = await fsPromises.readdir(root, { withFileTypes: true }).catch(() => [])
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory()) {
      return
    }
    const dir = path.join(root, entry.name)
    const stat = await fsPromises.stat(dir).catch(() => null)
    if (stat && stat.mtime.getTime() < cutoff) {
      await fsPromises.rm(dir, { recursive: true, force: true })
    }
  }))
}

export class SandboxRunSession {
  readonly runId: string
  readonly payload: SandboxRunPayload
  state: SandboxRunState = 'created'

  private readonly emitEvent: SandboxRunSessionOptions['emit']
  private readonly abortController = new AbortController()
  private readonly processEvents = new EventEmitter()
  private readonly writtenPaths = new Set<string>()
  private readonly storageChanges = new Map<string, StorageAccumulator>()
  private readonly llmRequests = new Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>()

  private timers: ReturnType<typeof createSandboxTimers> | undefined
  private playwright: ReturnType<typeof createSandboxPlaywrightFacade> | undefined
  private terminateReject!: (reason: unknown) => void
  private readonly terminated: Promise<never>

  constructor(opts: SandboxRunSessionOptions) {
    this.runId = opts.runId
    this.payload = opts.payload
    this.emitEvent = opts.emit
    this.terminated = new Promise<never>((_resolve, reject) => {
      this.terminateReject = reject
    })
    this.terminated.catch(() => {})
  }

  abort(reason: unknown = 'Sandbox run aborted'): void {
    if (this.state === 'finished' || this.state === 'disposed' || this.state === 'aborting') {
      return
    }
    this.state = 'aborting'
    const error = abortError(reason)
    this.abortController.abort(error)
    this.terminateReject(error)
    for (const pending of this.llmRequests.values()) {
      pending.reject(error)
    }
    this.llmRequests.clear()
  }

  handleLlmResponse(requestId: string, response: { ok: boolean, value?: unknown, error?: string }): boolean {
    const pending = this.llmRequests.get(requestId)
    if (!pending) {
      return false
    }
    this.llmRequests.delete(requestId)
    if (response.ok) {
      pending.resolve(response.value)
    }
    else {
      pending.reject(new Error(response.error || 'Sandbox LLM request failed'))
    }
    return true
  }

  async run(): Promise<SandboxHostRunResult> {
    this.state = 'running'
    this.phase('sandbox_execute_start')
    try {
      const result = await Promise.race([this.execute(), this.terminated])
      this.state = 'finished'
      return result
    }
    catch (error) {
      this.state = 'finished'
      if (error instanceof SandboxProcessExit) {
        if (error.code !== 0) {
          this.phase('run_failed')
        }
        return this.result(error.code === 0 ? 'done' : 'failed', error.code, undefined, error.code === 0 ? undefined : error.message)
      }
      if (this.abortController.signal.aborted) {
        this.phase('run_failed')
        return this.result('timeout', 124, undefined, errorMessage(error))
      }
      const message = errorDetail(error)
      this.phase('run_failed')
      this.log('error', `[sandbox] Script failed: ${message}`)
      return this.result('failed', 1, undefined, message)
    }
    finally {
      await this.dispose()
    }
  }

  async dispose(): Promise<void> {
    if (this.state === 'disposed') {
      return
    }
    const startedAt = Date.now()
    console.debug(`[sandbox] run=${this.runId} dispose started`)
    if (!this.abortController.signal.aborted) {
      this.abortController.abort(new Error('Sandbox run disposed'))
    }
    this.timers?.dispose()
    this.processEvents.removeAllListeners()
    for (const pending of this.llmRequests.values()) {
      pending.reject(new Error('Sandbox run disposed'))
    }
    this.llmRequests.clear()
    const playwrightDisposeStartedAt = Date.now()
    await this.playwright?.dispose()
    console.debug(`[sandbox] run=${this.runId} Playwright disposed durationMs=${Date.now() - playwrightDisposeStartedAt}`)
    this.state = 'disposed'
    console.debug(`[sandbox] run=${this.runId} dispose finished durationMs=${Date.now() - startedAt}`)
  }

  private async execute(): Promise<SandboxHostRunResult> {
    const payload = this.payload
    const browserUrl = new URL(payload.browserUrl)
    if (browserUrl.protocol !== 'ws:' && browserUrl.protocol !== 'wss:') {
      throw new Error(`Unsupported browser endpoint protocol: ${browserUrl.protocol}`)
    }
    if (!path.isAbsolute(payload.scriptPath)) {
      throw new Error('Sandbox scriptPath must be an absolute local path')
    }

    parseScriptPermissions(payload.permissions)
    await Promise.all([
      fsPromises.mkdir(payload.outputDir, { recursive: true }),
      fsPromises.mkdir(payload.browserOutputDir, { recursive: true }),
      fsPromises.mkdir(payload.logsDir, { recursive: true }),
      fsPromises.mkdir(path.dirname(payload.logFilePath), { recursive: true }),
    ])
    await cleanOldBrowserDirs(payload.browserOutputDir)
    this.phase('filesystem_ready')

    const source = await fsPromises.readFile(payload.scriptPath)
    if (payload.scriptSha512) {
      assertSha512(source, payload.scriptSha512)
    }
    this.phase('script_loaded')

    const runtime = createRuntimeContext({
      profile: payload.profile,
      runId: this.runId,
      dirId: payload.dirId ?? '',
      outputDir: payload.outputDir,
      logsDir: payload.logsDir,
      logFilePath: payload.logFilePath,
      ipcSend: (message) => {
        const event = message as { level?: string, message?: string }
        this.emitEvent({ type: 'log', level: event.level ?? 'info', message: event.message ?? '' })
      },
    })

    this.timers = createSandboxTimers(
      () => this.state === 'running',
      error => this.terminateReject(error),
    )
    this.playwright = createSandboxPlaywrightFacade({
      browserUrl: payload.browserUrl,
      browserOutputDir: payload.browserOutputDir,
      isActive: () => this.state === 'running',
      onPhase: phase => this.phase(phase),
    })

    const sandboxProcess = buildSandboxProcess({
      outputDir: payload.outputDir,
      env: {
        BROWSER_URL: payload.browserUrl,
        BROWSER_TYPE: payload.browserType,
        SANDBOX_DEBUG: payload.profile === 'debug' ? '1' : '0',
      },
      events: this.processEvents,
      write: (level, text) => this.log(level, text.replace(/\r?\n$/, '')),
      exit: (code = 0) => this.terminateReject(new SandboxProcessExit(code)),
      scriptPath: payload.scriptPath,
    })

    const fsModules = createSandboxFsModules({
      outputDir: payload.outputDir,
      readAllowlist: payload.permissions.fs.read,
      onWrite: filePath => this.writtenPaths.add(path.resolve(filePath)),
    })
    const tableApi = createTableApi({ storageDir: payload.outputDir, onChange: event => this.recordStorageChange(event) })
    const kvApi = createKvApi({ storageDir: payload.outputDir, onChange: event => this.recordStorageChange(event) })
    const debugApi = createDebugApi({
      enabled: payload.profile === 'debug',
      logsDir: payload.logsDir,
      debug: message => runtime.console.debug(message),
    })
    const downloadApi = createDownloadApi(payload.browserOutputDir)
    const llmApi = createLlmApi({ ask: request => this.requestLlm(request) })

    const sandboxApis: Record<string, Record<string, unknown>> = {
      'playwright': { chromium: this.playwright.chromium, firefox: this.playwright.firefox },
      'path': { ...path },
      'node:path': { ...path },
      'url': { ...url },
      'node:url': { ...url },
      'crypto': { ...crypto },
      'node:crypto': { ...crypto },
      'buffer': { ...buffer },
      'node:buffer': { ...buffer },
      'stream': { ...stream },
      'node:stream': { ...stream },
      'fs': fsModules.fs,
      'node:fs': fsModules.fs,
      'fs/promises': fsModules.promises,
      'node:fs/promises': fsModules.promises,
      '@roxybrowser/sandbox': sbRoot as Record<string, unknown>,
      '@roxybrowser/sandbox/utils': sbUtils as Record<string, unknown>,
      '@roxybrowser/sandbox/human': sbHuman as Record<string, unknown>,
      '@roxybrowser/sandbox/llm': llmApi as unknown as Record<string, unknown>,
      '@roxybrowser/sandbox/table': tableApi as Record<string, unknown>,
      '@roxybrowser/sandbox/kv': kvApi as Record<string, unknown>,
      '@roxybrowser/sandbox/debug': debugApi as unknown as Record<string, unknown>,
      '@roxybrowser/sandbox/download': downloadApi as unknown as Record<string, unknown>,
      '@roxybrowser/sandbox/2fa': sb2fa as Record<string, unknown>,
    }

    const restrictedFetch: typeof fetch = async (input, init) => {
      if (this.abortController.signal.aborted) {
        throw abortError(this.abortController.signal.reason)
      }
      const value = typeof input === 'string' || input instanceof URL ? input : input.url
      assertFetchAllowed(value, payload.permissions)
      const signal = init?.signal
        ? AbortSignal.any([init.signal, this.abortController.signal])
        : this.abortController.signal
      return globalThis.fetch(input, { ...init, redirect: 'manual', signal })
    }

    const context = vm.createContext(Object.create({
      console: runtime.console,
      fetch: restrictedFetch,
      XMLHttpRequest: undefined,
      process: sandboxProcess,
      setTimeout: this.timers.setTimeout,
      clearTimeout: this.timers.clearTimeout,
      setInterval: this.timers.setInterval,
      clearInterval: this.timers.clearInterval,
      setImmediate: this.timers.setImmediate,
      clearImmediate: this.timers.clearImmediate,
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      Error,
      TypeError,
      RangeError,
      Promise,
      JSON,
      Math,
      Date,
      parseInt: Number.parseInt,
      parseFloat: Number.parseFloat,
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      Object,
      Array,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      RegExp,
      Uint8Array,
      Uint16Array,
      Uint32Array,
      Int8Array,
      Int16Array,
      Int32Array,
      Float32Array,
      Float64Array,
      ArrayBuffer,
      SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : undefined,
      DataView,
    }))
    const moduleCache = new Map<string, vm.Module>()
    const linker = async (specifier: string): Promise<vm.Module> => {
      const cached = moduleCache.get(specifier)
      if (cached) {
        return cached
      }
      const exports = sandboxApis[specifier]
      if (!exports) {
        throw new Error(`[sandbox] Module not allowed: "${specifier}". Allowed: ${Object.keys(sandboxApis).join(', ')}`)
      }
      const exportNames = Object.keys(exports)
      const module = new vm.SyntheticModule(exportNames, function () {
        for (const name of exportNames) {
          this.setExport(name, exports[name])
        }
      }, { context, identifier: specifier })
      moduleCache.set(specifier, module)
      await module.link(linker)
      return module
    }

    const jsSource = stripTypeScriptTypes(source.toString('utf-8'), { mode: 'strip', sourceUrl: payload.scriptPath })
    const module = new vm.SourceTextModule(jsSource, { context, identifier: payload.scriptPath })
    await module.link(linker)
    await module.evaluate()
    this.phase('vm_ready')
    const mainPromise = executeSandboxScriptEntry(module.namespace as Record<string, unknown>, payload.options)
    this.phase('script_entry_start')
    mainPromise.catch(() => {})
    const returnValue = await Promise.race([mainPromise, this.terminated])
    return this.result('done', 0, returnValue)
  }

  private requestLlm(request: AskRequest): Promise<unknown> {
    if (this.abortController.signal.aborted) {
      return Promise.reject(abortError(this.abortController.signal.reason))
    }
    const options = request.options ? llmSerializableOptionsSchema.parse(request.options) : undefined
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      this.llmRequests.set(requestId, { resolve, reject })
      this.emitEvent({
        type: 'llm.request',
        requestId,
        request: {
          prompt: request.prompt,
          ...(request.schema ? { schema: request.schema } : {}),
          ...(options ? { options } : {}),
        },
      })
    })
  }

  private log(level: string, message: string): void {
    if (!message) {
      return
    }
    this.emitEvent({ type: 'log', level, message })
  }

  private phase(phase: SandboxRunPhase): void {
    this.emitEvent({ type: 'phase', phase, timestamp: Date.now() })
  }

  private recordStorageChange(event: {
    type: 'kv' | 'table'
    action: string
    name: string
    path: string
    rowCount?: number
  }): void {
    const resolved = path.resolve(event.path)
    this.writtenPaths.add(resolved)
    const key = `${event.type}:${resolved}`
    let item = this.storageChanges.get(key)
    if (!item) {
      item = { type: event.type, path: resolved, name: event.name, counts: new Map(), rowCounts: new Map() }
      this.storageChanges.set(key, item)
    }
    item.counts.set(event.action, (item.counts.get(event.action) ?? 0) + 1)
    if (event.rowCount !== undefined) {
      item.rowCounts.set(event.action, (item.rowCounts.get(event.action) ?? 0) + event.rowCount)
    }
  }

  private result(
    status: SandboxHostRunResult['status'],
    exitCode: number | null,
    returnValue?: string | void,
    error?: string,
  ): SandboxHostRunResult {
    return {
      status,
      exitCode,
      ...(returnValue !== undefined ? { returnValue } : {}),
      artifactPaths: Array.from(this.writtenPaths),
      storageChanges: Array.from(this.storageChanges.values()).map(item => ({
        type: item.type,
        path: item.path,
        name: item.name,
        operations: Array.from(item.counts.entries()).map(([action, count]): StorageOperation => ({
          action,
          count,
          ...(item.rowCounts.has(action) ? { rowCount: item.rowCounts.get(action)! } : {}),
        })),
      })),
      ...(error ? { error } : {}),
    }
  }
}
