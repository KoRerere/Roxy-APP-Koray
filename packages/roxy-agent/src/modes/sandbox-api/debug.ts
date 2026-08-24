/**
 * `@roxybrowser/sandbox/debug` — structured page diagnostics for sandbox scripts.
 *
 * `getPageHtml` reads a sanitized snapshot of the current rendered body DOM.
 * `capturePageSnapshot` persists that snapshot and reports its absolute path.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_MAX_HTML_BYTES = 5 * 1024 * 1024
const MAX_HTML_BYTES = 50 * 1024 * 1024
const LABEL_PATTERN = /^[a-z0-9](?:[\w.-]{0,78}[a-z0-9])?$/i

export type PageHtmlRoot = 'body' | { selector: string }
export type FormValueMode = 'mask' | 'include' | 'omit'

export interface PageHtmlOptions {
  /** Snapshot root. Defaults to the complete body element. */
  root?: PageHtmlRoot
  /** CSS selectors removed from the cloned DOM. Defaults to script and style. */
  remove?: string[]
  /** Remove HTML comments. Defaults to true. */
  stripComments?: boolean
  /** How live input, textarea, and select values are serialized. Defaults to mask. */
  formValues?: FormValueMode
  /** Maximum UTF-8 snapshot size. Defaults to 5 MiB; hard limit is 50 MiB. */
  maxBytes?: number
}

export interface PageHtmlStats {
  bytes: number
  removedNodes: Record<string, number>
  removedComments: number
}

export interface PageHtmlResult {
  html: string
  url: string
  title: string
  capturedAt: string
  stats: PageHtmlStats
}

export interface CapturePageSnapshotOptions extends PageHtmlOptions {
  /** Kebab-case stage label, such as before-submit. */
  label: string
}

export type CapturePageSnapshotResult
  = | { status: 'disabled' }
    | {
      status: 'captured'
      label: string
      htmlPath: string
      url: string
      title: string
      capturedAt: string
      stats: PageHtmlStats
    }

export interface DebugApiOptions {
  enabled?: boolean
  logsDir?: string
  maxHtmlBytes?: number
  debug?: (message: string) => void
}

interface NormalizedPageHtmlOptions {
  root: PageHtmlRoot
  remove: string[]
  stripComments: boolean
  formValues: FormValueMode
  maxBytes: number
}

interface EvaluatedPageHtml {
  html: string
  url: string
  title: string
  capturedAt: string
  bytes: number
  tooLarge: boolean
  removedNodes: Record<string, number>
  removedComments: number
}

/** Minimal Playwright Page surface used by this module. */
export interface DebugPage {
  evaluate: <Result, Arg>(pageFunction: (arg: Arg) => Result | Promise<Result>, arg: Arg) => Promise<Result>
}

function normalizeMaxBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_HTML_BYTES) {
    throw new Error(
      `[@roxybrowser/sandbox/debug] maxBytes must be an integer between 1 and ${MAX_HTML_BYTES}.`,
    )
  }
  return value
}

function normalizeOptions(options: PageHtmlOptions = {}, maxHtmlBytes = DEFAULT_MAX_HTML_BYTES): NormalizedPageHtmlOptions {
  const root = options.root ?? 'body'
  if (root !== 'body' && (
    typeof root !== 'object'
    || root === null
    || typeof root.selector !== 'string'
    || !root.selector.trim()
  )) {
    throw new Error('[@roxybrowser/sandbox/debug] root.selector is required.')
  }

  const remove = options.remove ?? ['script', 'style']
  if (!Array.isArray(remove)) {
    throw new TypeError('[@roxybrowser/sandbox/debug] remove must be an array of CSS selectors.')
  }
  if (remove.some(selector => typeof selector !== 'string' || !selector.trim())) {
    throw new Error('[@roxybrowser/sandbox/debug] remove selectors must not be empty.')
  }

  const formValues = options.formValues ?? 'mask'
  if (!['mask', 'include', 'omit'].includes(formValues)) {
    throw new Error(
      '[@roxybrowser/sandbox/debug] formValues must be mask, include, or omit.',
    )
  }

  return {
    root: root === 'body' ? root : { selector: root.selector.trim() },
    remove: Array.from(new Set(remove.map(selector => selector.trim()))),
    stripComments: options.stripComments ?? true,
    formValues,
    maxBytes: normalizeMaxBytes(options.maxBytes ?? maxHtmlBytes),
  }
}

function validateLabel(label: string): string {
  const normalized = label.trim()
  if (!LABEL_PATTERN.test(normalized) || normalized.includes('..')) {
    throw new Error(
      '[@roxybrowser/sandbox/debug] label must be 1-80 characters using letters, numbers, dot, underscore, or hyphen.',
    )
  }
  return normalized
}

async function atomicWrite(target: string, content: string): Promise<void> {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, content, 'utf-8')
    await rename(temporary, target)
  }
  finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

/**
 * Read a sanitized snapshot of the current rendered DOM.
 *
 * The default snapshot contains `document.body.outerHTML`, removes script/style
 * elements and comments, masks live form values, and preserves SVG markup.
 */
async function getPageHtmlWithLimit(page: DebugPage, options: PageHtmlOptions = {}, maxHtmlBytes = DEFAULT_MAX_HTML_BYTES): Promise<PageHtmlResult> {
  const normalized = normalizeOptions(options, maxHtmlBytes)
  const evaluated = await page.evaluate<EvaluatedPageHtml, NormalizedPageHtmlOptions>((input) => {
    // The agent package deliberately does not include the DOM lib. Keep the
    // evaluated callback structurally typed so it remains a Node-side module
    // while still using the browser's DOM at runtime.
    const doc = (globalThis as any).document
    const pageLocation = (globalThis as any).location
    const source: any = input.root === 'body'
      ? doc.body
      : doc.querySelector(input.root.selector)
    if (!source) {
      const description = input.root === 'body' ? 'document.body' : input.root.selector
      throw new Error(`Snapshot root not found: ${description}`)
    }

    const clone: any = source.cloneNode(true)
    const sourceControls: any[] = [source, ...Array.from(source.querySelectorAll('input, textarea, option'))]
    const clonedControls: any[] = [clone, ...Array.from(clone.querySelectorAll('input, textarea, option'))]

    for (let index = 0; index < sourceControls.length; index++) {
      const original = sourceControls[index]
      const copied = clonedControls[index]
      if (!copied) {
        continue
      }

      if (original?.tagName?.toLowerCase() === 'input' && copied?.tagName?.toLowerCase() === 'input') {
        if (original.checked) {
          copied.setAttribute('checked', '')
        }
        else {
          copied.removeAttribute('checked')
        }

        if (input.formValues === 'omit') {
          copied.removeAttribute('value')
        }
        else if (input.formValues === 'include') {
          copied.setAttribute('value', original.value)
        }
        else if (original.value) {
          copied.setAttribute('value', `[masked:${original.value.length}]`)
        }
        else {
          copied.removeAttribute('value')
        }
      }
      else if (original?.tagName?.toLowerCase() === 'textarea' && copied?.tagName?.toLowerCase() === 'textarea') {
        copied.textContent = input.formValues === 'include'
          ? original.value
          : input.formValues === 'mask' && original.value
            ? `[masked:${original.value.length}]`
            : ''
      }
      else if (original?.tagName?.toLowerCase() === 'option' && copied?.tagName?.toLowerCase() === 'option') {
        if (original.selected) {
          copied.setAttribute('selected', '')
        }
        else {
          copied.removeAttribute('selected')
        }

        if (input.formValues === 'omit') {
          copied.removeAttribute('value')
        }
        else if (input.formValues === 'include' && original.hasAttribute('value')) {
          copied.setAttribute('value', original.value)
        }
        else if (input.formValues === 'mask' && original.hasAttribute('value')) {
          copied.setAttribute('value', `[masked:${original.value.length}]`)
        }
      }
    }

    const containers: any[] = [clone]
    for (let index = 0; index < containers.length; index++) {
      for (const template of Array.from<any>(containers[index].querySelectorAll('template'))) {
        containers.push(template.content)
      }
    }

    const removedNodes: Record<string, number> = {}
    for (const selector of input.remove) {
      let removed = 0
      for (const container of containers) {
        const nodes = Array.from<any>(container.querySelectorAll(selector))
        removed += nodes.length
        for (const node of nodes) {
          node.remove()
        }
      }
      removedNodes[selector] = removed
    }

    let removedComments = 0
    if (input.stripComments) {
      for (const container of containers) {
        const walker = doc.createTreeWalker(container, 128)
        const comments: any[] = []
        while (walker.nextNode()) {
          comments.push(walker.currentNode)
        }
        removedComments += comments.length
        for (const comment of comments) {
          comment.parentNode?.removeChild(comment)
        }
      }
    }

    const html = clone.outerHTML
    const bytes = new TextEncoder().encode(html).byteLength
    return {
      html: bytes > input.maxBytes ? '' : html,
      url: pageLocation.href,
      title: doc.title,
      capturedAt: new Date().toISOString(),
      bytes,
      tooLarge: bytes > input.maxBytes,
      removedNodes,
      removedComments,
    }
  }, normalized)

  if (evaluated.tooLarge) {
    throw new Error(
      `[@roxybrowser/sandbox/debug] page HTML is ${evaluated.bytes} bytes, exceeding maxBytes ${normalized.maxBytes}.`,
    )
  }

  return {
    html: evaluated.html,
    url: evaluated.url,
    title: evaluated.title,
    capturedAt: evaluated.capturedAt,
    stats: {
      bytes: evaluated.bytes,
      removedNodes: evaluated.removedNodes,
      removedComments: evaluated.removedComments,
    },
  }
}

export function getPageHtml(page: DebugPage, options: PageHtmlOptions = {}): Promise<PageHtmlResult> {
  return getPageHtmlWithLimit(page, options)
}

/** Persist sanitized body HTML and report its absolute path through console.debug. */
async function capturePageSnapshotWithRuntime(
  page: DebugPage,
  options: CapturePageSnapshotOptions,
  runtime: {
    enabled: boolean
    logsDir?: string
    maxHtmlBytes: number
    debug?: (message: string) => void
  },
): Promise<CapturePageSnapshotResult> {
  if (!runtime.enabled) {
    return { status: 'disabled' }
  }

  const label = validateLabel(options.label)
  if (!runtime.logsDir) {
    throw new Error('[@roxybrowser/sandbox/debug] logsDir is not configured by the sandbox host.')
  }
  const logsDir = resolve(runtime.logsDir)
  const snapshot = await getPageHtmlWithLimit(page, options, runtime.maxHtmlBytes)
  const htmlPath = join(logsDir, `${randomUUID().slice(0, 8)}-${label}.html`)

  await atomicWrite(htmlPath, snapshot.html)
  runtime.debug?.(`Page HTML snapshot: ${htmlPath}`)

  return {
    status: 'captured',
    label,
    htmlPath,
    url: snapshot.url,
    title: snapshot.title,
    capturedAt: snapshot.capturedAt,
    stats: snapshot.stats,
  }
}

export interface SandboxDebugApi {
  getPageHtml: typeof getPageHtml
  capturePageSnapshot: (
    page: DebugPage,
    options: CapturePageSnapshotOptions,
  ) => Promise<CapturePageSnapshotResult>
  capturePageState: (page: DebugPage, label: string) => Promise<void>
}

/** Create debug functions bound to one sandbox run. */
export function createDebugApi(options: DebugApiOptions = {}): SandboxDebugApi {
  const runtime = {
    enabled: options.enabled ?? process.env.SANDBOX_DEBUG === '1',
    logsDir: options.logsDir ?? process.env.SANDBOX_LOGS_DIR,
    maxHtmlBytes: normalizeMaxBytes(options.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES),
    debug: options.debug,
  }
  return {
    getPageHtml: (page, pageOptions) => getPageHtmlWithLimit(page, pageOptions, runtime.maxHtmlBytes),
    capturePageSnapshot: (page, snapshotOptions) => capturePageSnapshotWithRuntime(page, snapshotOptions, runtime),
    capturePageState: async (page, label) => {
      await capturePageSnapshotWithRuntime(page, { label }, runtime)
    },
  }
}
