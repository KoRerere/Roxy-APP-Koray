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
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/i

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

export type CapturePageSnapshotResult =
  | { status: 'disabled' }
  | {
    status: 'captured'
    label: string
    htmlPath: string
    url: string
    title: string
    capturedAt: string
    stats: PageHtmlStats
  }

export interface DebugConfiguration {
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

let configuration: DebugConfiguration = {
  maxHtmlBytes: DEFAULT_MAX_HTML_BYTES,
}
let legacyLogsDir: string | undefined
let legacyEnabled: boolean | undefined
/** Host-only configuration. Hidden from scripts by the sandbox linker. */
export function __configureDebug(value: DebugConfiguration): void {
  configuration = {
    maxHtmlBytes: normalizeMaxBytes(value.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES),
    debug: value.debug,
  }
}

/** @deprecated Use __configureDebug. */
export function __setSnapshotDir(logsDir: string): void {
  legacyLogsDir = logsDir
}

/** @deprecated Use __configureDebug. */
export function __setEnabled(enabled: boolean): void {
  legacyEnabled = enabled
}

function isDebugEnabled(): boolean {
  const value = process.env.SANDBOX_DEBUG
  if (value !== undefined)
    return value === '1'
  return legacyEnabled ?? false
}

function normalizeMaxBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_HTML_BYTES) {
    throw new Error(
      `[@roxybrowser/sandbox/debug] maxBytes must be an integer between 1 and ${MAX_HTML_BYTES}.`,
    )
  }
  return value
}

function normalizeOptions(options: PageHtmlOptions = {}): NormalizedPageHtmlOptions {
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
  if (!Array.isArray(remove))
    throw new TypeError('[@roxybrowser/sandbox/debug] remove must be an array of CSS selectors.')
  if (remove.some(selector => typeof selector !== 'string' || !selector.trim()))
    throw new Error('[@roxybrowser/sandbox/debug] remove selectors must not be empty.')

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
    maxBytes: normalizeMaxBytes(options.maxBytes ?? configuration.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES),
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

function requireLogsDir(): string {
  const logsDir = process.env.SANDBOX_LOGS_DIR || legacyLogsDir
  if (!logsDir) {
    throw new Error(
      '[@roxybrowser/sandbox/debug] SANDBOX_LOGS_DIR is not configured by the sandbox host.',
    )
  }
  return resolve(logsDir)
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
export async function getPageHtml(page: DebugPage, options: PageHtmlOptions = {}): Promise<PageHtmlResult> {
  const normalized = normalizeOptions(options)
  const evaluated = await page.evaluate<EvaluatedPageHtml, NormalizedPageHtmlOptions>((input) => {
    const source = input.root === 'body'
      ? document.body
      : document.querySelector(input.root.selector)
    if (!source) {
      const description = input.root === 'body' ? 'document.body' : input.root.selector
      throw new Error(`Snapshot root not found: ${description}`)
    }

    const clone = source.cloneNode(true) as Element
    const sourceControls = [source, ...Array.from(source.querySelectorAll('input, textarea, option'))]
    const clonedControls = [clone, ...Array.from(clone.querySelectorAll('input, textarea, option'))]

    for (let index = 0; index < sourceControls.length; index++) {
      const original = sourceControls[index]
      const copied = clonedControls[index]
      if (!copied)
        continue

      if (original instanceof HTMLInputElement && copied instanceof HTMLInputElement) {
        if (original.checked)
          copied.setAttribute('checked', '')
        else
          copied.removeAttribute('checked')

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
      else if (original instanceof HTMLTextAreaElement && copied instanceof HTMLTextAreaElement) {
        copied.textContent = input.formValues === 'include'
          ? original.value
          : input.formValues === 'mask' && original.value
            ? `[masked:${original.value.length}]`
            : ''
      }
      else if (original instanceof HTMLOptionElement && copied instanceof HTMLOptionElement) {
        if (original.selected)
          copied.setAttribute('selected', '')
        else
          copied.removeAttribute('selected')

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

    const containers: ParentNode[] = [clone]
    for (let index = 0; index < containers.length; index++) {
      for (const template of Array.from(containers[index].querySelectorAll('template')))
        containers.push(template.content)
    }

    const removedNodes: Record<string, number> = {}
    for (const selector of input.remove) {
      let removed = 0
      for (const container of containers) {
        const nodes = Array.from(container.querySelectorAll(selector))
        removed += nodes.length
        for (const node of nodes)
          node.remove()
      }
      removedNodes[selector] = removed
    }

    let removedComments = 0
    if (input.stripComments) {
      for (const container of containers) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT)
        const comments: Node[] = []
        while (walker.nextNode())
          comments.push(walker.currentNode)
        removedComments += comments.length
        for (const comment of comments)
          comment.parentNode?.removeChild(comment)
      }
    }

    const html = clone.outerHTML
    const bytes = new TextEncoder().encode(html).byteLength
    return {
      html: bytes > input.maxBytes ? '' : html,
      url: location.href,
      title: document.title,
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

/** Persist sanitized body HTML and report its absolute path through console.debug. */
export async function capturePageSnapshot(
  page: DebugPage,
  options: CapturePageSnapshotOptions,
): Promise<CapturePageSnapshotResult> {
  if (!isDebugEnabled())
    return { status: 'disabled' }

  const label = validateLabel(options.label)
  const logsDir = requireLogsDir()
  const snapshot = await getPageHtml(page, options)
  const htmlPath = join(logsDir, `${randomUUID().slice(0, 8)}-${label}.html`)

  await atomicWrite(htmlPath, snapshot.html)
  configuration.debug?.(`Page HTML snapshot: ${htmlPath}`)

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

/** @deprecated Use capturePageSnapshot(page, { label }). */
export async function capturePageState(page: DebugPage, label: string): Promise<void> {
  await capturePageSnapshot(page, { label })
}
