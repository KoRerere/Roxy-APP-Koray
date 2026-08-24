import type { OfficialScriptsApi, TemplatesApi, UserTemplatesApi } from '@roxy/agent-api'
import type { UserGetPlatformInfoV2ListParams } from '@roxy/backend-api'
import { isTemplateRef } from '@roxy/shared'
import { API } from '/@/api'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { localizedSchemaText } from './script-template-params'
import { resolveCanonicalScriptTemplateName } from './scriptTemplatePresentation'
import { originalToolName } from './toolName'

interface HitlActionRequest {
  name: string
  args: unknown
}

interface HitlResourcePresentationOptions {
  officialScripts: Pick<OfficialScriptsApi, 'getOfficialScript'>
  templates: Pick<TemplatesApi, 'getOfficialTemplate'>
  userTemplates: Pick<UserTemplatesApi, 'getUserTemplate'>
  locale?: string
  workspaceName?: string
}

type PlatformLookupParams = UserGetPlatformInfoV2ListParams & { id: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeActions(value: unknown): HitlActionRequest[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => {
    const action = isRecord(item) ? item : {}
    return {
      name: asString(action.name),
      args: action.args,
    }
  })
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function readStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) {
      return [item.trim()]
    }
    if (typeof item === 'number' && Number.isFinite(item)) {
      return [String(item)]
    }
    return []
  }))
}

function readWindowIds(action: HitlActionRequest): string[] {
  if (Array.isArray(action.args)) {
    return readStringIds(action.args)
  }

  const args = isRecord(action.args) ? action.args : {}
  return readStringIds(args.dirIds)
}

function readResourceIds(action: HitlActionRequest): string[] {
  const args = isRecord(action.args) ? action.args : {}
  return readStringIds(args.ids)
}

function readScriptPath(action: HitlActionRequest): string {
  const args = isRecord(action.args) ? action.args : {}
  return asString(args.scriptPath)
}

function pathBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || value
}

function isAbsoluteScriptPath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\\\') || /^[a-z]:[\\/]/i.test(value)
}

function formatWindowNumber(sortNumber: number, workspaceName?: string): string {
  const prefix = getWorkspaceNamePrefix(workspaceName)
  return prefix ? `${prefix}-${sortNumber}` : String(sortNumber)
}

async function loadWindowNames(
  dirIds: readonly string[],
  workspaceName?: string,
): Promise<Map<string, string>> {
  if (dirIds.length === 0) {
    return new Map()
  }

  try {
    const response = await API.window.userGetWindowInfoV2List({
      page_index: 1,
      page_size: dirIds.length,
      dirIds: dirIds.join(','),
      isDelete: 0,
    })
    if (response.code !== 0) {
      throw new Error(response.msg || 'Failed to load windows')
    }

    return new Map((response.data?.rows ?? []).flatMap((row): Array<[string, string]> => {
      if (!row.dirId || typeof row.windowSortNum !== 'number') {
        return []
      }
      return [[row.dirId, formatWindowNumber(row.windowSortNum, workspaceName)]]
    }))
  }
  catch (error) {
    console.warn('[agent-console] Failed to resolve HITL window names:', error)
    return new Map()
  }
}

async function loadProxyNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map()
  }

  try {
    const response = await API.proxy.userGetProxyModuleList({
      page_index: 1,
      page_size: ids.length,
      id: ids.join(','),
    })
    if (response.code !== 0) {
      throw new Error(response.msg || 'Failed to load proxies')
    }

    return new Map((response.data?.rows ?? []).flatMap((row): Array<[string, string]> => {
      const name = asString(row.remark)
      return name ? [[String(row.id), name]] : []
    }))
  }
  catch (error) {
    console.warn('[agent-console] Failed to resolve HITL proxy names:', error)
    return new Map()
  }
}

async function loadPlatformAccountNames(ids: readonly string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(ids.map(async (id): Promise<[string, string] | undefined> => {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      return undefined
    }

    try {
      const query: PlatformLookupParams = {
        id: numericId,
        page_index: 1,
        page_size: 1,
      }
      const response = await API.platform.userGetPlatformInfoV2List(query)
      if (response.code !== 0) {
        throw new Error(response.msg || 'Failed to load platform account')
      }

      const row = response.data?.rows?.find(item => String(item.id) === id)
        ?? response.data?.rows?.[0]
      const name = asString(row?.platformUserName)
      return name ? [id, name] : undefined
    }
    catch (error) {
      console.warn(`[agent-console] Failed to resolve HITL platform account ${id}:`, error)
      return undefined
    }
  }))

  return new Map(entries.filter((entry): entry is [string, string] => Boolean(entry)))
}

async function loadScriptName(
  scriptPath: string,
  options: HitlResourcePresentationOptions,
): Promise<string> {
  if (!scriptPath) {
    return ''
  }
  if (isAbsoluteScriptPath(scriptPath)) {
    return pathBasename(scriptPath)
  }

  try {
    if (isTemplateRef(scriptPath)) {
      return await resolveCanonicalScriptTemplateName(scriptPath, options) || scriptPath
    }
    if (/^(?:official|user):/.test(scriptPath)) {
      return scriptPath
    }

    const response = await options.officialScripts.getOfficialScript({ scriptIdOrSlug: scriptPath })
    return localizedSchemaText(response.data?.name, options.locale) || scriptPath
  }
  catch (error) {
    console.warn(`[agent-console] Failed to resolve HITL script ${scriptPath}:`, error)
    return scriptPath
  }
}

function displayNames(ids: readonly string[], names: ReadonlyMap<string, string>): string {
  return ids.map(id => names.get(id) || id).join('、')
}

export async function resolveHitlActionTitles(
  actionRequests: unknown,
  options: HitlResourcePresentationOptions,
): Promise<Array<string | undefined>> {
  const actions = normalizeActions(actionRequests)
  const windowIds = uniqueStrings(actions.flatMap((action) => {
    const toolName = originalToolName(action.name)
    return toolName === 'roxy_profile_delete' || toolName === 'roxy_script_run'
      ? readWindowIds(action)
      : []
  }))
  const proxyIds = uniqueStrings(actions.flatMap(action =>
    originalToolName(action.name) === 'roxy_proxy_delete' ? readResourceIds(action) : []))
  const platformAccountIds = uniqueStrings(actions.flatMap(action =>
    originalToolName(action.name) === 'roxy_platform_account_delete' ? readResourceIds(action) : []))
  const scriptPaths = uniqueStrings(actions.flatMap(action =>
    originalToolName(action.name) === 'roxy_script_run' ? [readScriptPath(action)] : []))

  const [windowNames, proxyNames, platformAccountNames, scriptNameEntries] = await Promise.all([
    loadWindowNames(windowIds, options.workspaceName),
    loadProxyNames(proxyIds),
    loadPlatformAccountNames(platformAccountIds),
    Promise.all(scriptPaths.map(async scriptPath => [
      scriptPath,
      await loadScriptName(scriptPath, options),
    ] as const)),
  ])
  const scriptNames = new Map(scriptNameEntries)

  return actions.map((action) => {
    const toolName = originalToolName(action.name)
    if (toolName === 'roxy_profile_delete') {
      const names = displayNames(readWindowIds(action), windowNames)
      return names ? $t('删除窗口 {names}', { names }) : undefined
    }
    if (toolName === 'roxy_proxy_delete') {
      const names = displayNames(readResourceIds(action), proxyNames)
      return names ? $t('删除代理 IP {names}', { names }) : undefined
    }
    if (toolName === 'roxy_platform_account_delete') {
      const names = displayNames(readResourceIds(action), platformAccountNames)
      return names ? $t('删除平台账号 {names}', { names }) : undefined
    }
    if (toolName === 'roxy_script_run') {
      const windows = displayNames(readWindowIds(action), windowNames)
      const scriptPath = readScriptPath(action)
      const scriptName = scriptNames.get(scriptPath) || scriptPath
      if (windows && scriptName) {
        return $t('在窗口 {windows} 中运行脚本 {script}', { windows, script: scriptName })
      }
      if (scriptName) {
        return $t('运行脚本 {script}', { script: scriptName })
      }
    }

    return undefined
  })
}
