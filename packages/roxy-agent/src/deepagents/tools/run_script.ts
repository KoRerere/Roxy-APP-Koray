import type { FileCollectorStore } from '../fileCollector'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { API } from '@/api'
import { env } from '@/config'
import { getSkillManager } from '@/core/skillManager'
import { streamAdapter } from '@/core/sse/streamAdapter'
import { ScriptStore } from '@/database/conversations'
import { startSandboxScriptRun } from '@/services/sandboxService'
import { SCRIPT_PROMPT } from '../prompt/script'

interface RunScriptParam {
  scriptName?: string
  dirId?: string
  profile?: 'debug' | 'release'
  /** 脚本入参 options：可为 object 或 JSON string。运行时 typeof 判断后解析，注入子进程供 main(options) 使用。 */
  options?: unknown
}

export interface RunScriptToolOptions {
  workspaceDir?: string
  defaultDirId?: string
  defaultProfile?: 'debug' | 'release'
  allowLocalPaths?: boolean
  fileCollector?: FileCollectorStore
  scriptOutputDir?: string
  scriptLogsDir?: string
}

interface ScriptInfo {
  name?: string
  scriptOssUrl?: string
  title?: string
}

interface ResolvedScript {
  scriptPath: string
  localScriptId?: string
  defaultDirId?: string
}

function createRunId(): string {
  return `run_${timestamp()}_${randomUUID().slice(0, 8)}`
}

function timestamp(): string {
  return `${Math.floor(Date.now() / 1000)}`
}

function runSubDir(runId: string): string {
  return `${timestamp()}-${runId}`
}

function resolveRunPaths(runId: string, options: RunScriptToolOptions): { outputDir: string, logFilePath: string } {
  const logFileName = `script_${timestamp()}_${runId}.log`

  if (options.scriptOutputDir && options.scriptLogsDir) {
    const outputDir = path.join(options.scriptOutputDir, runSubDir(runId))
    // logsDir 与 outputDir 同根 → 日志与产物同落 run 子目录（主 agent）；
    // 否则日志直落 logsDir 根（enhance：直落工作区根）
    const logFilePath = options.scriptLogsDir === options.scriptOutputDir
      ? path.join(outputDir, logFileName)
      : path.join(options.scriptLogsDir, logFileName)
    return { outputDir, logFilePath }
  }

  // 手动运行回退：保持现有 script-runs 布局
  const base = path.join(env.CHECKPOINT_DIR, 'script-runs', runId)
  return {
    outputDir: path.join(base, 'workspace'),
    logFilePath: path.join(base, logFileName),
  }
}

async function createLogFile(logFilePath: string): Promise<void> {
  await fsPromises.mkdir(path.dirname(logFilePath), { recursive: true })
  await fsPromises.writeFile(logFilePath, '', 'utf-8')
}

function formatLogFilePath(logFilePath: string, options: RunScriptToolOptions): string {
  const workspaceDir = options.workspaceDir ? path.resolve(options.workspaceDir) : undefined
  const resolved = path.resolve(logFilePath)
  if (workspaceDir && (resolved === workspaceDir || resolved.startsWith(workspaceDir + path.sep))) {
    const relativePath = path.relative(workspaceDir, resolved) || path.basename(resolved)
    return SCRIPT_PROMPT.runScript.logFile(relativePath, resolved)
  }
  return SCRIPT_PROMPT.runScript.logFile(resolved)
}

function withLogFile(result: string, logFilePath: string, options: RunScriptToolOptions): string {
  return `${result}\n\n${formatLogFilePath(logFilePath, options)}`
}

let scriptListCache: ScriptInfo[] | null = null

async function getScriptList(): Promise<ScriptInfo[]> {
  if (scriptListCache) {
    return scriptListCache
  }
  const res = await API.base.userGetRpaScriptLibraryListList()
  scriptListCache = res.data?.rows || []
  return scriptListCache
}

async function resolveScriptUrl(scriptName: string): Promise<string | null> {
  const list = await getScriptList()
  const found = list.find(s => s.name === scriptName)
  return found?.scriptOssUrl || null
}

function resolveInWorkspace(workspaceDir: string, relPath: string): string {
  const cleaned = relPath.replace(/^[/\\]+/, '')
  const abs = path.resolve(workspaceDir, cleaned)
  const root = path.resolve(workspaceDir)
  if (abs !== root && !abs.startsWith(root + path.sep))
    throw new Error(SCRIPT_PROMPT.runScript.pathOutOfWorkspace(relPath))
  if (cleaned.includes('..'))
    throw new Error(SCRIPT_PROMPT.runScript.pathTraversal(relPath))
  return abs
}

/**
 * 判断 scriptName 是否为本地绝对路径（含 `~` 展开、Unix 绝对路径、Windows 盘符路径）。
 * 用于支持运行来自 skill 目录的脚本。
 */
function isLocalAbsolutePath(p: string): boolean {
  if (p.startsWith('~'))
    return true
  if (p.startsWith('/'))
    return true
  // Windows 盘符绝对路径：C:\ 或 C:/
  if (/^[a-z]:[\\/]/i.test(p))
    return true
  return false
}

/**
 * 解析 skill 目录内的本地脚本：仅允许 skills 目录内的文件（与 load_skill_file 同源守卫），
 * stat 确认是文件后直接用。不在 skills 目录内或非文件 → 抛错（由上层 catch 转为 resolveFailed 文案）。
 * 不预校验脚本结构——不符规范由 sandbox 运行时报错。
 */
async function resolveSkillScript(rawPath: string): Promise<string> {
  const abs = path.resolve(rawPath)
  if (!getSkillManager().isPathInsideSkillsRoot(abs)) {
    throw new Error(SCRIPT_PROMPT.runScript.outsideSkillsRoot(rawPath))
  }
  const stat = await fsPromises.stat(abs).catch(() => null)
  if (!stat || !stat.isFile()) {
    throw new Error(SCRIPT_PROMPT.runScript.localPathNotFile(rawPath))
  }
  return abs
}

async function resolveScriptPath(scriptName: string, options: RunScriptToolOptions): Promise<ResolvedScript | null> {
  if (/^https?:\/\//.test(scriptName)) {
    return { scriptPath: scriptName }
  }

  // 本地绝对路径（含 ~）：仅允许运行 skills 目录内的脚本（与 load_skill_file 同源守卫），
  // 不预校验——结构不符由 sandbox 运行时报错。
  if (isLocalAbsolutePath(scriptName)) {
    const abs = await resolveSkillScript(scriptName)
    return { scriptPath: abs }
  }

  if (options.allowLocalPaths && options.workspaceDir) {
    const localPath = resolveInWorkspace(options.workspaceDir, scriptName)
    const stat = await fsPromises.stat(localPath).catch(() => null)
    if (stat?.isFile()) {
      return { scriptPath: localPath }
    }
  }

  // 查本地录制脚本库，先按 ID 精确匹配，其次按 name
  try {
    if (scriptName.startsWith('scr_')) {
      const byId = ScriptStore.getById(scriptName)
      if (byId) {
        const scriptPath = byId.oss_url || byId.local_path
        if (scriptPath)
          return { scriptPath, localScriptId: byId.id, defaultDirId: byId.dir_id ?? undefined }
      }
    }

    const localScripts = ScriptStore.list()
    const matched = localScripts.find(s => s.name === scriptName)
    if (matched) {
      const scriptPath = matched.oss_url || matched.local_path
      if (scriptPath) {
        return {
          scriptPath,
          localScriptId: matched.id,
          defaultDirId: matched.dir_id ?? undefined,
        }
      }
    }
  }
  catch {
    // 查本地库失败，继续尝试官方库
  }

  const ossUrl = await resolveScriptUrl(scriptName)
  if (!ossUrl)
    return null
  return { scriptPath: ossUrl }
}

export function createRunScriptTool(options: RunScriptToolOptions = {}): StructuredToolInterface {
  return tool(
    async (
      input: { script: RunScriptParam },
      _config: any,
    ): Promise<string> => {
      if (!input.script.scriptName)
        return SCRIPT_PROMPT.runScript.paramIsEmpty('scriptName')

      const abortSignal: AbortSignal | undefined = _config?.signal

      if (abortSignal?.aborted)
        return SCRIPT_PROMPT.runScript.aborted

      const runSpec = input.script

      let resolved: ResolvedScript | null
      try {
        resolved = await resolveScriptPath(runSpec.scriptName!, options)
      }
      catch (err: any) {
        return SCRIPT_PROMPT.runScript.resolveFailed(runSpec.scriptName!, String(err?.message ?? err))
      }

      if (!resolved)
        return SCRIPT_PROMPT.runScript.notFound(runSpec.scriptName!)

      const { scriptPath, localScriptId, defaultDirId: localDirId } = resolved
      const dirId = runSpec.dirId?.trim() || localDirId || options.defaultDirId
      if (!dirId)
        return SCRIPT_PROMPT.runScript.missingTarget(runSpec.scriptName!)

      console.debug(`[run_script] Running: ${runSpec.scriptName}, dirId: ${dirId}`)

      // 解析脚本入参 options：接受 object 或 JSON string。string 解析失败时返回错误，不静默吞掉。
      let resolvedOptions: unknown
      if (runSpec.options === undefined || runSpec.options === null) {
        resolvedOptions = undefined
      }
      else if (typeof runSpec.options === 'string') {
        const trimmed = runSpec.options.trim()
        if (!trimmed) {
          resolvedOptions = undefined
        }
        else {
          try {
            resolvedOptions = JSON.parse(trimmed)
          }
          catch (err: any) {
            return SCRIPT_PROMPT.runScript.optionsParseFailed(String(err?.message ?? err))
          }
        }
      }
      else {
        resolvedOptions = runSpec.options
      }

      const profile = runSpec.profile || options.defaultProfile || 'release'
      const runId = createRunId()
      const { outputDir, logFilePath } = resolveRunPaths(runId, options)

      let aborted = false
      const onAbort = () => {
        aborted = true
      }
      abortSignal?.addEventListener('abort', onAbort, { once: true })

      const writer: ((sse: string) => void) | undefined = (_config as any)?.writer
      try {
        await createLogFile(logFilePath)

        const run = await startSandboxScriptRun({
          scriptPath,
          dirId,
          runId,
          profile,
          outputDir,
          workspaceDir: options.workspaceDir,
          logFilePath,
          options: resolvedOptions,
          signal: abortSignal,
          onLog: (msg) => {
            writer?.(streamAdapter.scriptLog({
              scriptName: runSpec.scriptName,
              level: msg.level,
              message: msg.message,
              toolId: (_config as any)?.toolCall?.id,
              runId: msg.runId,
            }))
          },
        })

        const result = await run.finished
        if (aborted)
          return withLogFile(SCRIPT_PROMPT.runScript.interrupted(runSpec.scriptName!), logFilePath, options)

        if (result.status === 'done') {
          if (localScriptId && dirId) {
            try {
              ScriptStore.updateDirId(localScriptId, dirId)
            }
            catch {
              // 回写失败不影响主流程
            }
          }

          // release 模式：将产物注册到 fileCollector，轮末统一由 publishCollectedFiles 入库推送
          if (profile === 'release' && result.artifacts.length > 0 && options.fileCollector) {
            for (const a of result.artifacts) {
              options.fileCollector.record({
                virtualPath: `/script-runs/${runId}/${a.relPath ?? a.fileName}`,
                realPath: a.localPath,
                displayName: a.relPath ?? a.fileName,
                op: 'write',
              })
            }
          }

          return withLogFile(SCRIPT_PROMPT.runScript.success(runSpec.scriptName!), logFilePath, options)
        }
        if (result.status === 'killed')
          return withLogFile(SCRIPT_PROMPT.runScript.killed(runSpec.scriptName!), logFilePath, options)
        if (result.status === 'timeout')
          return withLogFile(SCRIPT_PROMPT.runScript.timeout(runSpec.scriptName!), logFilePath, options)
        return withLogFile(SCRIPT_PROMPT.runScript.exitCode(runSpec.scriptName!, result.exitCode), logFilePath, options)
      }
      catch (err: any) {
        console.error(`[run_script] Failed to run script: ${err?.message ?? String(err)}`)
        writer?.(streamAdapter.scriptLog({
          scriptName: runSpec.scriptName,
          level: 'error',
          message: err?.message ?? String(err),
          toolId: (_config as any)?.toolCall?.id,
        }))
        return withLogFile(SCRIPT_PROMPT.runScript.startFailed(runSpec.scriptName!, err?.message ?? String(err)), logFilePath, options)
      }
      finally {
        abortSignal?.removeEventListener('abort', onAbort)
      }
    },
    {
      name: 'run_script',
      description: SCRIPT_PROMPT.runScript.description,
      schema: z.object({
        script: z.object({
          scriptName: z
            .string()
            .optional()
            .describe(SCRIPT_PROMPT.runScript.scriptNameDescription),
          dirId: z.string().optional().describe(SCRIPT_PROMPT.runScript.dirIdDescription),
          profile: z.enum(['debug', 'release']).optional().describe(SCRIPT_PROMPT.runScript.profileDescription),
          options: z.unknown().optional().describe(SCRIPT_PROMPT.runScript.optionsDescription),
        }),
      }),
    },
  ) as unknown as StructuredToolInterface
}
