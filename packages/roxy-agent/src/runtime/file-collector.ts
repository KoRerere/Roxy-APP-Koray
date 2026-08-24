import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

export interface RuntimeCollectedFile {
  virtualPath: string
  realPath: string
  op: 'write' | 'edit'
  displayName?: string
  source?: RuntimeCollectedFileSource
  toolName?: string
  toolUseId?: string
  workerId?: string
  agentPath?: string
}

export type RuntimeCollectedFileSource
  = | 'write_file'
    | 'edit_file'
    | 'apply_patch'
    | 'roxy_script_run'
    | 'sandbox_fs'
    | 'sandbox_table'
    | 'sandbox_kv'
    | 'sandbox_download'
    | 'playwright_screenshot'
    | 'playwright_download'
    | 'artifact_root_scan'
    | (string & {})

export interface RuntimeFileCollector {
  record: (file: RuntimeCollectedFile) => void
  addArtifactRoot: (root: string, displayPrefix?: string) => void
  consume: () => RuntimeCollectedFile[]
  peek: () => RuntimeCollectedFile[]
}

export interface RuntimeFileCollectorOptions {
  /** Browser MCP and sandbox roots whose newly-created files should be collected. */
  artifactRoots?: string[]
  /** Root used to produce stable user-facing relative paths. */
  displayRoot?: string
}

const IGNORED_ARTIFACT_NAMES = new Set(['recording.jsonl', 'metadata.json'])

function shouldScanArtifact(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase()
  return !name.endsWith('.log')
    && !name.endsWith('.kv.json')
    && !name.endsWith('.jsonl')
    && !IGNORED_ARTIFACT_NAMES.has(name)
}

function walkFiles(
  root: string,
  known: Set<string>,
  result: RuntimeCollectedFile[],
  displayRoot?: string,
  artifactRoot: string = root,
  displayPrefix?: string,
): void {
  if (!existsSync(root)) {
    return
  }
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, known, result, displayRoot, artifactRoot, displayPrefix)
      continue
    }
    if (!entry.isFile() || !shouldScanArtifact(fullPath)) {
      continue
    }
    const resolved = path.resolve(fullPath)
    if (known.has(resolved)) {
      continue
    }
    known.add(resolved)
    const relativeName = displayPrefix
      ? path.join(displayPrefix, path.relative(artifactRoot, resolved))
      : displayRoot ? path.relative(displayRoot, resolved) : path.basename(resolved)
    result.push({
      virtualPath: relativeName,
      realPath: resolved,
      op: 'write',
      displayName: relativeName,
      source: inferScannedArtifactSource(resolved),
    })
  }
}

function inferScannedArtifactSource(filePath: string): RuntimeCollectedFileSource {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  if (normalized.includes('/screenshots/') || normalized.includes('/screenshot/')) {
    return 'playwright_screenshot'
  }
  if (normalized.includes('/downloads/') || normalized.includes('/download/')) {
    return 'playwright_download'
  }
  return 'artifact_root_scan'
}

/** Turn-scoped artifact collector owned by the runtime integration path. */
export function createRuntimeFileCollector(options: RuntimeFileCollectorOptions = {}): RuntimeFileCollector {
  const files = new Map<string, RuntimeCollectedFile>()
  const knownPaths = new Set<string>()
  const artifactRoots = new Map<string, string | undefined>()

  function addArtifactRoot(root: string, displayPrefix?: string): void {
    const resolvedRoot = path.resolve(root)
    if (artifactRoots.has(resolvedRoot)) {
      return
    }
    artifactRoots.set(resolvedRoot, displayPrefix)
    if (!existsSync(resolvedRoot)) {
      return
    }
    const existing: RuntimeCollectedFile[] = []
    walkFiles(
      resolvedRoot,
      knownPaths,
      existing,
      options.displayRoot ? path.resolve(options.displayRoot) : undefined,
      resolvedRoot,
      displayPrefix,
    )
  }

  for (const root of options.artifactRoots ?? []) {
    addArtifactRoot(root)
  }

  function scanArtifactRoots(): void {
    for (const [root, displayPrefix] of artifactRoots) {
      const discovered: RuntimeCollectedFile[] = []
      walkFiles(
        root,
        knownPaths,
        discovered,
        options.displayRoot ? path.resolve(options.displayRoot) : undefined,
        root,
        displayPrefix,
      )
      for (const file of discovered) {
        files.set(file.realPath, file)
      }
    }
  }

  return {
    record(file) {
      files.set(file.virtualPath, file)
    },
    addArtifactRoot,
    consume() {
      scanArtifactRoots()
      const result = [...files.values()]
      files.clear()
      return result
    },
    peek() {
      scanArtifactRoots()
      return [...files.values()]
    },
  }
}
