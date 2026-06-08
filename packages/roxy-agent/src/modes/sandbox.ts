// @ts-expect-error 不需要检测
// import { chromium } from '@roxybrowser/playwright-mcp'
import buffer from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import stream from 'node:stream'
import url from 'node:url'
import vm from 'node:vm'

export async function runSandboxMode() {
  const activeBrowsers = new Set<any>()

  process.on('SIGTERM', async () => {
    console.log(`[worker] SIGTERM received, closing ${activeBrowsers.size} browser(s)...`)
    process.exit(124)
  })

  const scriptPath = process.argv[2]
  if (!scriptPath) {
    console.error('[worker] No script path provided.')
    process.exit(1)
  }

  let tsSource: string
  if (/^https?:\/\//.test(scriptPath)) {
    console.log(`[worker] Fetching script from: ${scriptPath}`)
    const resp = await fetch(scriptPath)
    if (!resp.ok) {
      console.error(`[worker] Failed to fetch script: ${resp.status} ${resp.statusText}`)
      process.exit(1)
    }
    tsSource = await resp.text()
    console.log(`[worker] Script fetched, size: ${tsSource.length} bytes`)
  }
  else {
    tsSource = fs.readFileSync(scriptPath, 'utf-8')
    console.log(`[worker] Script loaded from disk, size: ${tsSource.length} bytes`)
  }

  console.log(`[worker] Stripping TypeScript types...`)
  const jsSource = stripTypeScriptTypes(tsSource, { mode: 'strip', sourceUrl: scriptPath })

  class SandboxExit {
    code: number
    constructor(code: number) { this.code = code }
  }

  const sandboxApis: Record<string, Record<string, unknown>> = {
    // 'playwright': { chromium },
    'fs': { ...fs },
    'node:fs': { ...fs },
    'path': { ...path },
    'node:path': { ...path },
    'os': { ...os },
    'node:os': { ...os },
    'crypto': { ...crypto },
    'node:crypto': { ...crypto },
    'buffer': { ...buffer },
    'node:buffer': { ...buffer },
    'stream': { ...stream },
    'node:stream': { ...stream },
    'url': { ...url },
    'node:url': { ...url },
  }

  const object = Object.create({
    console,
    fetch,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    process: Object.freeze({
      env: Object.freeze({ ...process.env }),
      cwd: process.cwd,
      exit: process.exit,
    }),
    report: (markdown: string) => {
      process.send?.({ type: 'script_message', message: String(markdown) })
    },
    // JS built-ins (not available in vm context by default)
    Buffer: buffer.Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Error,
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
    ArrayBuffer,
  })

  const context = vm.createContext(Object.freeze(object))

  const moduleCache = new Map<string, vm.Module>()

  async function linker(specifier: string, _referencingModule: vm.Module): Promise<vm.Module> {
    if (moduleCache.has(specifier)) {
      return moduleCache.get(specifier)!
    }

    let synth: vm.Module

    if (specifier in sandboxApis) {
      const exports = sandboxApis[specifier]
      const exportNames = Object.keys(exports)
      synth = new vm.SyntheticModule(exportNames, function () {
        for (const name of exportNames) {
          this.setExport(name, exports[name])
        }
      }, { context, identifier: specifier })
    }
    else {
      console.error(`[worker] Module not allowed in sandbox: "${specifier}". Add it to sandboxApis to use it.`)
      throw new Error(`Module not allowed in sandbox: '${specifier}'`)
    }

    await synth.link(linker)
    moduleCache.set(specifier, synth)
    return synth
  }

  console.log(`[worker] Running: ${scriptPath}`)
  try {
    console.log(`[worker] Creating SourceTextModule...`)
    const mod = new vm.SourceTextModule(jsSource, {
      context,
      identifier: scriptPath,
    })

    console.log(`[worker] Linking module...`)
    await mod.link(linker)
    console.log(`[worker] Evaluating module...`)
    await mod.evaluate({ timeout: 2 * 60 * 1000 })
    console.log(`[worker] Module evaluated successfully.`)
  }
  catch (err: any) {
    if (err instanceof SandboxExit) {
      console.log(`[worker] Script exited with code ${err.code}.`)
      process.exit(err.code)
    }
    console.error('[worker] Script failed:')
    console.error('  message:', err?.message || String(err))
    if (err?.code)
      console.error('  code:', err.code)
    if (err?.stack)
      console.error('  stack:', err.stack)
    process.exit(1)
  }

  return () => {
    process.exit(1)
  }
}
