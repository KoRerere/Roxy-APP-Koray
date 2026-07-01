import fixPath from 'fix-path'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Resolve the effective PATH for runtime detection.
// On macOS/Linux, GUI apps launched outside a login shell don't inherit the full
// shell PATH — fix-path reads it from the user's shell profile.
// On Windows, installers update the registry but the running process keeps its
// stale PATH until restarted; we read HKLM/HKCU directly to pick up new installs.
let _effectivePathCache: Promise<string> | null = null

function getEffectivePath(): Promise<string> {
  if (_effectivePathCache) {
    return _effectivePathCache
  }
  _effectivePathCache = resolveEffectivePath()
  return _effectivePathCache
}

async function resolveEffectivePath(): Promise<string> {
  if (process.platform === 'win32') {
    return getWindowsRegistryPath()
  }
  try {
    fixPath()
  }
  catch {}
  return process.env.PATH || ''
}

async function getWindowsRegistryPath(): Promise<string> {
  const queryKey = async (key: string): Promise<string> => {
    try {
      const result = await execFileAsync('reg', ['query', key, '/v', 'Path'], { windowsHide: true })
      return result.stdout.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i)?.[1]?.trim() ?? ''
    }
    catch {
      return ''
    }
  }
  const [systemPath, userPath] = await Promise.all([
    queryKey('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'),
    queryKey('HKCU\\Environment'),
  ])
  return [userPath, systemPath].filter(Boolean).join(';') || process.env.PATH || ''
}

const NODE_RUNTIME_ID = 'node'
const PYTHON_RUNTIME_ID = 'python'

const NODE_SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'])
const PYTHON_SCRIPT_EXTENSIONS = new Set(['.py'])
const OTHER_SCRIPT_EXTENSIONS = new Set([
  '.bat',
  '.bash',
  '.cmd',
  '.fish',
  '.lua',
  '.php',
  '.pl',
  '.ps1',
  '.rb',
  '.sh',
  '.zsh',
])
const SCRIPT_INDICATOR_FILES = new Map<string, SupportedRuntimeId>([
  ['package.json', NODE_RUNTIME_ID],
  ['pyproject.toml', PYTHON_RUNTIME_ID],
  ['requirements.txt', PYTHON_RUNTIME_ID],
])
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.mypy_cache',
  '.svn',
  '.venv',
  '__pycache__',
  'node_modules',
  'venv',
])

const SUPPORTED_RUNTIME_DEFAULTS = {
  [NODE_RUNTIME_ID]: {
    displayName: 'Node.js',
    homepage: 'https://nodejs.org/en/download',
  },
  [PYTHON_RUNTIME_ID]: {
    displayName: 'Python',
    homepage: 'https://www.python.org/downloads/',
  },
} as const

export type SupportedRuntimeId = 'node' | 'python'
export type SkillRuntimeSource = 'declared' | 'inferred' | 'none'

export interface SkillRuntimeDeclaration {
  id: string
  homepage?: string
  displayName?: string
  versionHint?: string
}

export interface SkillRuntimeDescriptor {
  id: string
  homepage: string
  displayName: string
  versionHint?: string
  source: Exclude<SkillRuntimeSource, 'none'>
}

export interface SkillRuntimeDetectionResult {
  hasScripts: boolean
  runtimeSource: SkillRuntimeSource
  runtimes: SkillRuntimeDescriptor[]
}

export interface RuntimeAvailability {
  installed: boolean
  version?: string
}

export type RuntimeCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ stdout?: string, stderr?: string }>

const defaultRuntimeCommandRunner: RuntimeCommandRunner = async (command, args) => {
  const PATH = await getEffectivePath()
  return execFileAsync(command, [...args], {
    windowsHide: true,
    env: { ...process.env, PATH },
  })
}

export function isSupportedRuntimeId(id: string): id is SupportedRuntimeId {
  return id === NODE_RUNTIME_ID || id === PYTHON_RUNTIME_ID
}

export function getDefaultRuntimeDisplayName(id: string): string {
  return SUPPORTED_RUNTIME_DEFAULTS[id as SupportedRuntimeId]?.displayName ?? id
}

export function getDefaultRuntimeHomepage(id: string): string {
  return SUPPORTED_RUNTIME_DEFAULTS[id as SupportedRuntimeId]?.homepage ?? ''
}

export function normalizeDeclaredRuntimes(
  value: unknown,
  skillPath: string,
): { runtimes?: SkillRuntimeDeclaration[], warnings: string[] } {
  if (value == null) {
    return { warnings: [] }
  }

  if (!Array.isArray(value)) {
    return {
      warnings: [`Ignoring invalid runtimes in ${skillPath}: expected an array`],
    }
  }

  const warnings: string[] = []
  const runtimes: SkillRuntimeDeclaration[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      warnings.push(`Ignoring invalid runtime entry in ${skillPath}: expected an object`)
      continue
    }

    const record = item as Record<string, unknown>
    const id = String(record.id ?? '').trim()
    if (!id) {
      warnings.push(`Ignoring runtime entry without an id in ${skillPath}`)
      continue
    }

    const homepage = typeof record.homepage === 'string' ? record.homepage.trim() : ''
    const displayName = typeof record.displayName === 'string' ? record.displayName.trim() : ''
    const versionHint = typeof record.versionHint === 'string' ? record.versionHint.trim() : ''

    runtimes.push({
      id,
      ...(homepage ? { homepage } : {}),
      ...(displayName ? { displayName } : {}),
      ...(versionHint ? { versionHint } : {}),
    })
  }

  return { runtimes, warnings }
}

export async function detectSkillRuntimes(
  rootDir: string,
  declaredRuntimes?: SkillRuntimeDeclaration[],
): Promise<SkillRuntimeDetectionResult> {
  if (declaredRuntimes?.length) {
    return {
      hasScripts: true,
      runtimeSource: 'declared',
      runtimes: declaredRuntimes.map(runtime => ({
        id: runtime.id,
        displayName: runtime.displayName || getDefaultRuntimeDisplayName(runtime.id),
        homepage: runtime.homepage || getDefaultRuntimeHomepage(runtime.id),
        ...(runtime.versionHint ? { versionHint: runtime.versionHint } : {}),
        source: 'declared',
      })),
    }
  }

  const scanResult = await scanSkillFiles(rootDir)
  if (scanResult.inferredRuntimeIds.size > 0) {
    return {
      hasScripts: true,
      runtimeSource: 'inferred',
      runtimes: [...scanResult.inferredRuntimeIds].map(id => ({
        id,
        displayName: getDefaultRuntimeDisplayName(id),
        homepage: getDefaultRuntimeHomepage(id),
        source: 'inferred',
      })),
    }
  }

  return {
    hasScripts: scanResult.hasScripts,
    runtimeSource: 'none',
    runtimes: [],
  }
}

export async function probeRuntimeAvailability(
  runtimeId: SupportedRuntimeId,
  runner: RuntimeCommandRunner = defaultRuntimeCommandRunner,
): Promise<RuntimeAvailability> {
  const candidates
    = runtimeId === NODE_RUNTIME_ID
      ? [{ command: 'node', args: ['--version'] as const }]
      : [
          { command: 'python', args: ['--version'] as const },
          { command: 'python3', args: ['--version'] as const },
          // { command: 'py', args: ['-3', '--version'] as const },
        ]

  for (const candidate of candidates) {
    try {
      const result = await runner(candidate.command, candidate.args)
      const version = extractVersionOutput(result.stdout, result.stderr)
      return version ? { installed: true, version } : { installed: true }
    }
    catch {
    }
  }

  return { installed: false }
}

async function scanSkillFiles(rootDir: string): Promise<{ hasScripts: boolean, inferredRuntimeIds: Set<SupportedRuntimeId> }> {
  const inferredRuntimeIds = new Set<SupportedRuntimeId>()
  let hasScripts = false

  async function walk(currentDir: string): Promise<void> {
    if (hasScripts && inferredRuntimeIds.size === 2) {
      return
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') {
        continue
      }

      const entryPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await walk(entryPath)
        }
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const fileName = entry.name.toLowerCase()
      const extension = path.extname(fileName)

      const indicatorRuntime = SCRIPT_INDICATOR_FILES.get(fileName)
      if (indicatorRuntime) {
        hasScripts = true
        inferredRuntimeIds.add(indicatorRuntime)
        continue
      }

      if (NODE_SCRIPT_EXTENSIONS.has(extension)) {
        hasScripts = true
        inferredRuntimeIds.add(NODE_RUNTIME_ID)
        continue
      }

      if (PYTHON_SCRIPT_EXTENSIONS.has(extension)) {
        hasScripts = true
        inferredRuntimeIds.add(PYTHON_RUNTIME_ID)
        continue
      }

      if (OTHER_SCRIPT_EXTENSIONS.has(extension)) {
        hasScripts = true
      }

      if (!extension || OTHER_SCRIPT_EXTENSIONS.has(extension)) {
        const shebang = await readShebang(entryPath)
        if (!shebang) {
          continue
        }

        hasScripts = true
        if (isNodeShebang(shebang)) {
          inferredRuntimeIds.add(NODE_RUNTIME_ID)
        }
        else if (isPythonShebang(shebang)) {
          inferredRuntimeIds.add(PYTHON_RUNTIME_ID)
        }
      }
    }
  }

  await walk(rootDir)
  return { hasScripts, inferredRuntimeIds }
}

async function readShebang(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const firstLine = content.split(/\r?\n/u, 1)[0]?.trim()
    return firstLine?.startsWith('#!') ? firstLine : null
  }
  catch {
    return null
  }
}

function isNodeShebang(shebang: string): boolean {
  return /\bnode(?:\.exe)?\b/i.test(shebang)
}

function isPythonShebang(shebang: string): boolean {
  return /\bpython(?:\d+(?:\.\d+)?)?(?:\.exe)?\b/i.test(shebang)
}

function extractVersionOutput(stdout?: string, stderr?: string): string | undefined {
  const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim()
  if (!output) {
    return undefined
  }

  return output.split(/\r?\n/u, 1)[0]?.trim() || undefined
}
