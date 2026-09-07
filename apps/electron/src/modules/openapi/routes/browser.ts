import { genRandomFingerprint, isChromiumCoreUnsupported } from '@roxy/shared'
import { screen } from 'electron'
import express from 'express'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { isMac, isProd, openAPICommonHeaders } from '/@/constants/common'
import { browserManager, coreManager } from '/@/modules/browser'
import { browserAutomationControlManager } from '/@/modules/browser/automation-control'
import { registerChunkLayoutReflowShortcut, setChunkLayoutSnapshot } from '/@/modules/browser/browser-manager/chunkLayoutReflow'
import { ipcSender } from '/@/modules/ipc/sender'
import { store } from '/@/modules/store'
import { accountMapping, browserListMapping, browserListMappingV2, browserListMappingV3, browserTemplateMapping, mapping2List, mapping2Object } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { getErrorMessage, getLocalFonts, getMacAddress, safeParseJSON } from '/@/utils'
import { buildChunkLaunchParamsByDirId, computeWindowGridLayouts, sortDisplaysSpatial } from '/@/utils/windowGridLayout'
import { writeCodexBootstrapConfig } from '../codexBootstrapConfig'
import { createWorkspaceCredentialsService } from '../workspaceCredentials'
import { createWorkspaceSelectionService } from '../workspaceSelection'
import { workspaceSwitchBridge } from '../workspaceSwitchBridgeInstance'
import { getDefaultBrowserCreateParams } from './constants/'

const router = express.Router()

function getRequestApiKey(req: express.Request) {
  const apiKey = req.header('token')?.trim()
  if (!apiKey) {
    throw new Error('token is required')
  }
  return apiKey
}

const workspaceCredentials = createWorkspaceCredentialsService({
  listWorkspaces: async (apiKey) => {
    // APIKey 作用域接口只返回当前绑定空间；切换校验必须使用登录用户的完整空间列表。
    console.log('[workspace-select] list workspaces:start', {
      apiKeySuffix: apiKey ? apiKey.slice(-4) : '',
      storeWorkspaceId: store.workspaceId,
    })
    const result = await API.limit.userGetWorkspaceListList()
    console.log('[workspace-select] list workspaces:result', {
      code: result.code,
      msg: result.msg,
      workspaceIds: result.data?.rows?.map(item => item.id),
      storeWorkspaceId: store.workspaceId,
    })
    return {
      ...result,
      data: {
        total: result.data?.total ?? 0,
        rows: result.data?.rows ?? [],
      },
    }
  },
  getWorkspaceApiKey: async (workspaceId) => {
    console.log('[workspace-select] get target api key:start', {
      workspaceId,
      storeWorkspaceId: store.workspaceId,
    })
    const result = await API.base.userGetUserApiList({ headers: { workspaceId } })
    console.log('[workspace-select] get target api key:result', {
      workspaceId,
      code: result.code,
      msg: result.msg,
      hasApiKey: Boolean(result.data?.apiKey),
      storeWorkspaceId: store.workspaceId,
    })
    return result
  },
})

const workspaceSelection = createWorkspaceSelectionService({
  getActiveWorkspaceId: () => store.workspaceId,
  getOpenedBrowserCount: () => new Set([
    ...browserManager.openedBrowserMap.keys(),
    ...browserManager.openingBrowserMap.keys(),
  ]).size,
  hasWorkspace: (apiKey, workspaceId) => workspaceCredentials.hasWorkspace(apiKey, workspaceId),
  getCredentials: (apiKey, workspaceId) => workspaceCredentials.select(apiKey, workspaceId),
  requestFrontendSwitch: workspaceId => workspaceSwitchBridge.request(workspaceId),
})

router.post('/automation/acquire', async (req, res) => {
  const { dirId, executionId, label } = req.body ?? {}
  if (typeof dirId !== 'string' || !dirId.trim()) {
    return res.error('dirId is required')
  }
  if (typeof executionId !== 'string' || !executionId.trim()) {
    return res.error('executionId is required')
  }
  if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
    return res.error('label must be a non-empty string')
  }
  if (typeof label === 'string' && [...label.trim()].length > 16) {
    return res.error('label must not exceed 16 characters')
  }

  try {
    res.success(await browserAutomationControlManager.acquire({ dirId, executionId, label }))
  }
  catch (error) {
    res.error(getErrorMessage(error))
  }
})

router.post('/automation/sync', async (req, res) => {
  const { dirId, executionId, targetId, label } = req.body ?? {}
  if (typeof dirId !== 'string' || !dirId.trim()) {
    return res.error('dirId is required')
  }
  if (typeof executionId !== 'string' || !executionId.trim()) {
    return res.error('executionId is required')
  }
  if (typeof targetId !== 'string' || !targetId.trim()) {
    return res.error('targetId is required')
  }
  if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
    return res.error('label must be a non-empty string')
  }
  if (typeof label === 'string' && [...label.trim()].length > 16) {
    return res.error('label must not exceed 16 characters')
  }

  try {
    res.success(await browserAutomationControlManager.sync({ dirId, executionId, targetId, label }))
  }
  catch (error) {
    res.error(getErrorMessage(error))
  }
})

router.post('/automation/release', async (req, res) => {
  const { dirId, executionId } = req.body ?? {}
  if (typeof dirId !== 'string' || !dirId.trim()) {
    return res.error('dirId is required')
  }
  if (typeof executionId !== 'string' || !executionId.trim()) {
    return res.error('executionId is required')
  }

  try {
    res.success(await browserAutomationControlManager.release({ dirId, executionId }))
  }
  catch (error) {
    res.error(getErrorMessage(error))
  }
})

// sourceType 后端用于区分来源的字段

type OpenWindowLayout = 'grid' | 'stack'
type AgentOpenStatus = 'core_downloading' | 'launching'

interface AgentOpenRuntimeStatus {
  dirId: string
  status: AgentOpenStatus
  coreType?: string
  coreVersion?: string
  percent?: number
  downloadStatus?: string
  updatedAt: number
}

const agentOpenRuntimeStatusMap = new Map<string, AgentOpenRuntimeStatus>()

function isUnsupportedCoreForRequest(req: express.Request, winInfo: Record<string, any>) {
  return isChromiumCoreUnsupported(
    isMac ? 'mac' : undefined,
    req.header('osversion') ?? osConfig.osVersion,
    winInfo.coreType,
    winInfo.coreVersion,
  )
}

function getUnsupportedCoreError(coreVersion: unknown) {
  return $t('当前系统不支持使用{version}内核', { version: String(coreVersion ?? '') })
}

function setAgentOpenRuntimeStatus(status: Omit<AgentOpenRuntimeStatus, 'updatedAt'>) {
  const nextStatus = {
    ...status,
    updatedAt: Date.now(),
  }
  agentOpenRuntimeStatusMap.set(status.dirId, nextStatus)
  return nextStatus
}

function getAgentOpenRuntimeStatus(dirId: string) {
  const status = agentOpenRuntimeStatusMap.get(dirId)
  if (!status) {
    return null
  }

  if (browserManager.openedBrowserMap.has(dirId)) {
    agentOpenRuntimeStatusMap.delete(dirId)
    return null
  }

  if (status.status === 'core_downloading' && status.coreVersion) {
    const payload = coreManager.getCoreManager(status.coreType as any).getCoreDownloadPayload(status.coreVersion)
    if (payload) {
      status.percent = payload.percent ?? status.percent
      status.downloadStatus = payload.status ?? status.downloadStatus
      status.updatedAt = Date.now()
    }
  }

  return status
}

function serializeAgentOpenRow(row: any) {
  const { updatedAt: _updatedAt, ...rest } = row
  return rest
}

function getOpenedAgentWindowRow(dirId: string) {
  const browserItem = browserManager.openedBrowserMap.get(dirId)
  return {
    dirId,
    success: true,
    status: 'opened' as const,
    coreType: browserItem?.coreType ?? browserItem?.winInfo?.coreType,
    launchInfo: browserItem?.launchInfo,
  }
}

function getAgentOpenStatusRow(dirId: string) {
  if (browserManager.openedBrowserMap.has(dirId)) {
    const browserItem = browserManager.openedBrowserMap.get(dirId)
    const launchInfo = browserItem?.launchInfo ?? {}
    return {
      ...launchInfo,
      dirId: launchInfo.dirId ?? dirId,
      success: true,
      status: 'opened' as const,
      coreType: browserItem?.coreType ?? browserItem?.winInfo?.coreType,
    }
  }

  const runtimeStatus = getAgentOpenRuntimeStatus(dirId)
  if (runtimeStatus) {
    return serializeAgentOpenRow(runtimeStatus)
  }

  return null
}

function resolveStatusDirIds(input: Record<string, any>) {
  if (input.dirIds === undefined && input.dirId === undefined) {
    return undefined
  }
  if (Array.isArray(input.dirIds)) {
    return input.dirIds.filter((dirId): dirId is string => typeof dirId === 'string' && Boolean(dirId))
  }
  if (typeof input.dirIds === 'string') {
    return input.dirIds.split(',').map(dirId => dirId.trim()).filter(Boolean)
  }
  return typeof input.dirId === 'string' && input.dirId ? [input.dirId] : []
}

function getAgentOpenStatusRows(dirIds?: string[]) {
  if (dirIds?.length) {
    return dirIds.map(getAgentOpenStatusRow).filter(Boolean)
  }

  const allDirIds = new Set<string>([
    ...browserManager.openedBrowserMap.keys(),
    ...agentOpenRuntimeStatusMap.keys(),
  ])
  return [...allDirIds].map(getAgentOpenStatusRow).filter(Boolean)
}

async function handleAgentOpenStatus(req: express.Request, res: express.Response) {
  const input = req.query as Record<string, any>
  const dirIds = resolveStatusDirIds(input)
  const result = getAgentOpenStatusRows(dirIds?.length ? dirIds : undefined)

  res.success(result)
}

function normalizeOpenArgs(args: unknown, headless: boolean) {
  if (!Array.isArray(args)) {
    throw new TypeError('args is not array')
  }

  const nextArgs = [...args]
  if (headless && !nextArgs.includes('--headless=new')) {
    nextArgs.push('--headless=new')
  }
  return nextArgs
}

function resolveOpenDirIds(body: Record<string, any>): string[] {
  if (Array.isArray(body.dirIds)) {
    return body.dirIds.filter((dirId): dirId is string => typeof dirId === 'string' && Boolean(dirId))
  }
  return typeof body.dirId === 'string' && body.dirId ? [body.dirId] : []
}

function buildGridCustomParamsByDirId(dirIds: string[], gridOpts: Record<string, any> = {}) {
  const displays = sortDisplaysSpatial(
    screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
    })),
  )

  const layouts = computeWindowGridLayouts(displays, dirIds.length, {
    gap: gridOpts.gap,
    cols: gridOpts.cols,
    rows: gridOpts.rows,
    stackOffset: gridOpts.stackOffset,
  })

  setChunkLayoutSnapshot({
    orderedDirIds: dirIds.slice(),
    gridOpts: {
      gap: gridOpts.gap,
      cols: gridOpts.cols,
      rows: gridOpts.rows,
      stackOffset: gridOpts.stackOffset,
    },
  })
  registerChunkLayoutReflowShortcut()

  return buildChunkLaunchParamsByDirId(dirIds, layouts)
}

type AgentLaunchCoreCheckResult
  = | { ok: true, status: 'downloaded', availableCore: any }
    | {
      ok: false
      status: 'core_downloading'
      coreType: string
      coreVersion: string
      percent: number
      downloadStatus?: string
      downloadPromise: Promise<any>
    }
    | { ok: false, status: 'core_error', error: string }

async function prepareAgentLaunchCore(winInfo: any, req?: express.Request): Promise<AgentLaunchCoreCheckResult> {
  let coreType = winInfo.coreType
  let coreVersion = winInfo.coreVersion
  let coreManagerUtils = coreManager.getCoreManager(coreType)

  if (!coreManagerUtils.availableCoreList.length) {
    const result = await coreManagerUtils.fetchAvailableCoreList().catch((error) => {
      console.error('fetchAvailableCoreList error', { coreType, coreVersion, error })
      return null
    })
    if (!result || result.code !== 0) {
      return {
        ok: false,
        status: 'core_error' as const,
        error: $t('获取内核信息失败'),
      }
    }
  }

  if (winInfo.useLatestCore === true) {
    const latestCoreListResult = await coreManagerUtils.fetchAvailableCoreList().catch((error) => {
      console.error('fetch latest availableCoreList error', { coreType, coreVersion, error })
      return null
    })
    if (!latestCoreListResult || latestCoreListResult.code !== 0) {
      return {
        ok: false,
        status: 'core_error' as const,
        error: $t('获取内核信息失败'),
      }
    }

    const latestCoreResult = await coreManager.resolveCoreParams(coreType, undefined, { fillDefaults: true })
    if (!latestCoreResult.ok) {
      return {
        ok: false,
        status: 'core_error' as const,
        error: latestCoreResult.error,
      }
    }
    coreType = latestCoreResult.coreType
    coreVersion = latestCoreResult.coreVersion
    coreManagerUtils = coreManager.getCoreManager(coreType)
    winInfo.coreType = coreType
    winInfo.coreVersion = coreVersion
  }

  if (req && isUnsupportedCoreForRequest(req, { coreType, coreVersion })) {
    return {
      ok: false,
      status: 'core_error' as const,
      error: getUnsupportedCoreError(coreVersion),
    }
  }

  const availableCore = coreManagerUtils.getAvailableCore(coreVersion)
  if (!availableCore?.coreVersion) {
    return {
      ok: false,
      status: 'core_error' as const,
      error: $t('当前系统不支持使用{version}内核', { version: coreVersion }),
    }
  }

  const isReadyForLaunch = await coreManagerUtils.isCoreReadyForLaunch(coreVersion)
  if (!isReadyForLaunch) {
    const downloadPromise = coreManagerUtils.downloadCore({
      coreVersion,
      silent: true,
    }).catch((error) => {
      console.error('agent open background core download error', { coreType, coreVersion, error })
      return Promise.reject(error)
    })
    const payload = coreManagerUtils.getCoreDownloadPayload(coreVersion)

    return {
      ok: false,
      status: 'core_downloading' as const,
      coreType,
      coreVersion,
      percent: payload?.percent ?? 0,
      downloadStatus: payload?.status ?? 'downloading',
      downloadPromise,
    }
  }

  return {
    ok: true,
    status: 'downloaded',
    availableCore,
  }
}

async function launchAgentWindow(dirId: string, winInfo: any, args: any[], customParams: Record<string, any> = {}) {
  const startupParam = [winInfo.startupParam, ...args].filter(Boolean).join(';')
  const launchInfo = await browserManager.launchWithLimit({
    ...winInfo,
    ...customParams,
    startupParam,
  }, 'api')

  return {
    dirId,
    success: true,
    status: 'opened' as const,
    coreType: winInfo.coreType,
    launchInfo,
  }
}

async function launchAgentWindowAfterCoreDownload(
  dirId: string,
  winInfo: any,
  args: any[],
  customParams: Record<string, any>,
  coreCheck: Extract<AgentLaunchCoreCheckResult, { status: 'core_downloading' }>,
) {
  try {
    await coreCheck.downloadPromise
  }
  catch (error) {
    agentOpenRuntimeStatusMap.delete(dirId)
    console.error('agent open background core download failed', {
      dirId,
      coreType: coreCheck.coreType,
      coreVersion: coreCheck.coreVersion,
      error: getErrorMessage(error),
    })
    return
  }

  setAgentOpenRuntimeStatus({
    dirId,
    status: 'launching',
    coreType: coreCheck.coreType,
    coreVersion: coreCheck.coreVersion,
    percent: 100,
    downloadStatus: 'downloaded',
  })

  try {
    const result = await launchAgentWindow(dirId, winInfo, args, customParams)
    agentOpenRuntimeStatusMap.delete(dirId)
    return result
  }
  catch (error) {
    agentOpenRuntimeStatusMap.delete(dirId)
    console.error('agent open background launch failed', {
      dirId,
      coreType: coreCheck.coreType,
      coreVersion: coreCheck.coreVersion,
      error: getErrorMessage(error),
    })
  }
}

function parseTemplateContent(content: unknown) {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content
  }
  if (typeof content !== 'string' || !content) {
    return {}
  }
  return safeParseJSON(content, () => ({})) ?? {}
}

// 下一期开放新增 / 修改模板时恢复：写入后端时再压回字符串
// function stringifyTemplateContent(content: unknown): string | undefined {
//   if (typeof content === 'string') {
//     return content
//   }
//   if (content == null) {
//     return undefined
//   }
//   return JSON.stringify(content)
// }

/** OpenAPI 对外用短值（label），后端存储真实 URL */
const CHECK_CHANNEL_MAP: Record<string, string> = {
  'IPRust.io': 'http://iprust.io/ip.json',
  'IP-API': 'http://pro.ip-api.com/json?key=c1ulk9X5j8NKqTV',
  'IP123.in': 'http://ip123.in/ip.json',
  IPinfo: 'http://ipinfo.io',
  IP2Location: 'http://api.ip2location.io/?key=C67DFE07AF4B75B505BE2B4B5A757900',
}

/** 按 label 或完整 URL 匹配渠道；大小写不同时再兜底一次 */
function findCheckChannel(current: string) {
  const value = CHECK_CHANNEL_MAP[current]
  if (value) {
    return { label: current, value }
  }
  const byValue = Object.entries(CHECK_CHANNEL_MAP).find(([, url]) => url === current)
  if (byValue) {
    return { label: byValue[0], value: byValue[1] }
  }
  const lower = current.toLowerCase()
  const byLabel = Object.entries(CHECK_CHANNEL_MAP).find(([label]) => label.toLowerCase() === lower)
  if (byLabel) {
    return { label: byLabel[0], value: byLabel[1] }
  }
}

/** 只改 content.checkChannel，未命中映射时保持原值以免丢掉自定义渠道 */
function mapTemplateCheckChannel(
  content: Record<string, any>,
  to: 'label' | 'value',
) {
  const current = content.checkChannel
  if (typeof current !== 'string' || !current) {
    return content
  }
  const matched = findCheckChannel(current)
  if (!matched) {
    return content
  }
  return {
    ...content,
    checkChannel: to === 'label' ? matched.label : matched.value,
  }
}

// 下一期开放新增 / 修改模板时恢复：把 OpenAPI 的 proxyInfo / fingerInfo 摊平给后端
// function flattenOpenApiCreateParams(content: Record<string, any>) {
//   const { proxyInfo, fingerInfo, workspaceId: _workspaceId, ...rest } = content
//   return {
//     ...rest,
//     ...(proxyInfo && typeof proxyInfo === 'object' && !Array.isArray(proxyInfo) ? proxyInfo : {}),
//     ...(fingerInfo && typeof fingerInfo === 'object' && !Array.isArray(fingerInfo) ? fingerInfo : {}),
//   }
// }

/** 先转扁平 checkChannel，再嵌套成创建窗口同款结构 */
function prepareTemplateContentForRead(content: unknown) {
  const flat = mapTemplateCheckChannel(parseTemplateContent(content), 'label')
  return mapping2Object(flat, browserTemplateMapping)
}

// 下一期开放新增 / 修改模板时恢复
// function prepareTemplateContentForWrite(content: unknown) {
//   if (content == null) {
//     return undefined
//   }
//   const flat = flattenOpenApiCreateParams(parseTemplateContent(content))
//   return stringifyTemplateContent(mapTemplateCheckChannel(flat, 'value'))
// }

/** 获取账号列表 */
router.get('/account', async (req, res) => {
  const { workspaceId, accountId: id, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.platform.userGetPlatformInfoV2List({ id, ...rest }, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(accountMapping, result.data.rows)
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 获得标签列表 */
router.get('/label', async (req, res) => {
  const { workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.api.userGetLabelInfoApiList({ ...rest }, { headers: { workspaceId, ...openAPICommonHeaders } })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 获取空间项目列表 */
router.get('/workspace', async (req, res) => {
  const { ...rest } = req.query as Record<string, any>
  try {
    console.debug('get workspace list with params', rest)
    const result = await API.api.userGetWorkspaceListApiList({ ...rest }, { headers: { ...openAPICommonHeaders } })
    console.debug('workspace list', result)
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = result.data.rows.map((item) => {
        Reflect.deleteProperty(item, 'userId')
        return item
      })
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 切换 API 调用方使用的空间，并返回目标空间最新的 OpenAPI 配置 */
router.post('/workspace/select', async (req, res) => {
  const { workspaceId, force } = req.body ?? {}
  console.log('[workspace-select] request', {
    workspaceId,
    force,
    storeWorkspaceId: store.workspaceId,
    openedBrowserCount: new Set([
      ...browserManager.openedBrowserMap.keys(),
      ...browserManager.openingBrowserMap.keys(),
    ]).size,
  })
  if (workspaceId === undefined || workspaceId === null || workspaceId === '') {
    return res.error('workspaceId is required')
  }
  if (force !== undefined && typeof force !== 'boolean') {
    return res.error('force must be a boolean')
  }

  try {
    const result = await workspaceSelection.select(getRequestApiKey(req), workspaceId, { force })
    if (result.switched) {
      if (!result.credentials.port || result.credentials.port < 0) {
        throw new Error('OpenAPI server port is unavailable')
      }
      const written = await writeCodexBootstrapConfig({
        apiKey: result.credentials.apiKey,
        workspaceId,
        apiHost: `http://127.0.0.1:${result.credentials.port}`,
      }, { isProduction: isProd })
      if (!written) {
        throw new Error('failed to persist workspace API credentials')
      }
    }
    console.log('[workspace-select] selection complete', {
      workspaceId,
      switched: result.switched,
      storeWorkspaceId: store.workspaceId,
      hasApiKey: Boolean(result.credentials?.apiKey),
    })
    if (result.switched) {
      res.once('finish', () => {
        void ipcSender.user.workspaceSelectCompleted({
          requestId: result.requestId,
          workspaceId,
        })
      })
    }
    res.success(result.credentials)
  }
  catch (error) {
    console.error('[workspace-select] selection failed', {
      workspaceId,
      storeWorkspaceId: store.workspaceId,
      error: getErrorMessage(error),
    })
    res.error(getErrorMessage(error))
  }
})

/** 获取当前 APIKey 对应的 active 空间详情 */
router.get('/workspace/active', async (req, res) => {
  try {
    // 以当前 APIKey 对应空间的最新配置为准，避免切换重启尚未完成时返回旧的本地端口。
    res.success(await workspaceCredentials.getActive(getRequestApiKey(req)))
  }
  catch (error) {
    res.error(getErrorMessage(error))
  }
})

/* 创建窗口 */
router.post('/create', async (req, res) => {
  const { proxyInfo = {}, windowPlatformList = [], fingerInfo = {}, workspaceId, coreType, coreVersion } = req.body || {}

  // 根据用户传入的 coreType / coreVersion 校验当前系统可用内核，缺省时回落为最新版本
  const coreResult = await coreManager.resolveCoreParams(coreType, coreVersion, { fillDefaults: true })
  if (!coreResult.ok) {
    return res.error(coreResult.error)
  }

  if (isUnsupportedCoreForRequest(req, coreResult)) {
    return res.error(getUnsupportedCoreError(coreResult.coreVersion))
  }

  const _platformUrlIds = windowPlatformList.map(item => item.id).filter(Boolean)
  const _windowPlatformList = windowPlatformList.filter(item => !item.id)
  if (Reflect.has(proxyInfo, 'moduleId')) {
    proxyInfo.proxyMethod = proxyInfo.moduleId !== 0 ? 'choose' : 'custom'
  }

  const params = {
    ...getDefaultBrowserCreateParams(),
    ...req.body,
    coreType: coreResult.coreType,
    coreVersion: coreResult.coreVersion,
    ...proxyInfo,
    ...fingerInfo,
    platformUrlIds: _platformUrlIds,
    windowPlatformList: _windowPlatformList,
  }

  try {
    const [data] = await genRandomFingerprint({
      payload: params,
      count: 1,
      API,
      genType: 'api',
      getMacAddress,
      local_fonts: getLocalFonts(),
    })

    // 如果是用户自定义
    if (params.webGLInfo === 2) {
      data.webGLRender = params.webGLRender || data.webGLRender
      data.webGLManufacturer = params.webGLManufacturer || data.webGLManufacturer
    }

    const result = await API.window.userAddWindowInfoV2Create({
      ...params,
      ...data,
    }, {
      headers: {
        workspaceId,
        ...openAPICommonHeaders,
      },
    })

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

// 修改窗口
router.post('/mdf', async (req, res) => {
  const { proxyInfo = {}, windowPlatformList = [], fingerInfo = {}, workspaceId, coreType, coreVersion } = req.body || {}

  if (isUnsupportedCoreForRequest(req, { coreType, coreVersion })) {
    return res.error(getUnsupportedCoreError(coreVersion))
  }

  const _platformUrlIds = windowPlatformList.map(item => item.id).filter(Boolean)
  const _windowPlatformList = windowPlatformList.filter(item => !item.id)
  if (Reflect.has(proxyInfo, 'moduleId')) {
    proxyInfo.proxyMethod = proxyInfo.moduleId !== 0 ? 'choose' : 'custom'
  }
  const params = {
    ...req.body,
    ...proxyInfo,
    ...fingerInfo,
    platformUrlIds: _platformUrlIds,
    windowPlatformList: _windowPlatformList,
  }

  const result = await API.window.userMdfWindowInfoSingleV2Create(params, {
    headers: {
      workspaceId,
      ...openAPICommonHeaders,
    },
  })
  res.json(result)
})

/* 获取浏览器窗口列表 已废弃 */
router.get('/list', async (req, res) => {
  const { dirId, workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoV2List({ dirId, ...rest }, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      // console.log('browserListMapping', result.data.rows)
      result.data.rows = mapping2List(result.data.rows, browserListMapping, ['cookie'])
    }
    res.json(result)
  }
  catch (error) {
    console.error('list error', error)
    res.error(error)
  }
})

/* 获取浏览器窗口列表 新接口（已废弃，请用 list_v3） */
router.get('/list_v2', async (req, res) => {
  const { workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoListList(rest, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      // console.log('browserListV2Mapping', result.data.rows)
      result.data.rows = mapping2List(result.data.rows, browserListMappingV2)
    }
    res.json(result)
  }
  catch (error) {
    console.error('list error', error)
    res.error(error)
  }
})

router.get('/list_v3', async (req, res) => {
  const { workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoListList(rest, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mapping2List(result.data.rows, browserListMappingV3)
    }
    res.json(result)
  }
  catch (error) {
    console.error('list error', error)
    res.error(error)
  }
})

router.get('/detail', async (req, res) => {
  const { workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoV2List(rest, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      // console.log('browserListV2Mapping', result.data.rows)
      result.data.rows = mapping2List(result.data.rows, browserListMappingV2, ['cookie'])
    }
    res.json(result)
  }
  catch (error) {
    console.error('list error', error)
    res.error(error)
  }
})

/* 删除窗口 */
router.post('/delete', async (req, res) => {
  const { dirIds, workspaceId, isSoftDelete = false } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const hasOpenedBrowser = dirIds.some(dirId => browserManager.openedBrowserMap.has(dirId))
  if (hasOpenedBrowser) {
    return res.error($t('请先关闭窗口'))
  }

  try {
    // 每次删除窗口前，先同步一下窗口的打开状态，避免无法删除
    const windowStatus = dirIds.map(dirId => ({ dirId, openStatus: false }))
    await API.window.userMdfWindowSyncV2Create(windowStatus)

    let result

    // 如果是软删除
    if (isSoftDelete) {
      result = await API.window.userMdfWindowInfoBatchV2Create({ dirIds, isDelete: true } as any, { headers: { workspaceId, ...openAPICommonHeaders } })
    }
    else {
      result = await API.api.userDelWindowInfoApiV2Create({ dirIds }, { headers: { workspaceId, ...openAPICommonHeaders } })
    }
    await Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalData(dirId)))

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 获取窗口模板列表 */
router.get('/template', async (req, res) => {
  const { workspaceId } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowTemplateListList({
      headers: { workspaceId, ...openAPICommonHeaders },
    })
    if (result.code === 0 && Array.isArray(result.data)) {
      res.json({
        ...result,
        data: result.data.filter(item => item.id).map(item => ({
          ...item,
          content: prepareTemplateContentForRead(item.content),
        })),
      })
      return
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

// 下一期开放：新增窗口模板
// router.post('/template', async (req, res) => {
//   const { workspaceId, templateName, content } = req.body || {}
//   if (!templateName) {
//     return res.error('templateName is required')
//   }
//
//   try {
//     const result = await API.window.userAddWindowTemplateInfoCreate({
//       templateName,
//       content: prepareTemplateContentForWrite(content),
//     }, {
//       headers: { workspaceId, ...openAPICommonHeaders },
//     })
//     res.json(result)
//   }
//   catch (error) {
//     res.error(error)
//   }
// })
//
// 下一期开放：修改窗口模板
// router.post('/template/mdf', async (req, res) => {
//   const { workspaceId, id, templateName, content } = req.body || {}
//   if (!id) {
//     return res.error('id is required')
//   }
//   if (!templateName) {
//     return res.error('templateName is required')
//   }
//
//   try {
//     const result = await API.window.userMdfWindowTemplateInfoCreate({
//       id: Number(id),
//       templateName,
//       content: prepareTemplateContentForWrite(content),
//     }, {
//       headers: { workspaceId, ...openAPICommonHeaders },
//     })
//     res.json(result)
//   }
//   catch (error) {
//     res.error(error)
//   }
// })
//
// 下一期开放：删除窗口模板
// router.post('/template/delete', async (req, res) => {
//   const { workspaceId, id } = req.body || {}
//   if (!id) {
//     return res.error('id is required')
//   }
//
//   try {
//     const result = await API.window.userDeleteWindowTemplateInfoCreate({
//       id: Number(id),
//     }, {
//       headers: { workspaceId, ...openAPICommonHeaders },
//     })
//     res.json(result)
//   }
//   catch (error) {
//     res.error(error)
//   }
// })

/** 打开浏览器窗口 */
router.post('/open', async (req, res) => {
  const { dirId, workspaceId, args = [], forceOpen = false, headless = false } = req.body

  if (!dirId) {
    return res.error('dirId is required')
  }

  if (!Array.isArray(args)) {
    return res.error('args is not array')
  }

  if (browserManager.openedBrowserMap.has(dirId)) {
    res.success(browserManager.openedBrowserMap.get(dirId)?.launchInfo, 'browser is already opened')
    return
  }

  if (headless && !args.includes('--headless=new')) {
    args.push('--headless=new')
  }

  try {
    // 如果不强制打开，先检查窗口是否被其他用户占用
    if (!forceOpen) {
      const { code, data, msg } = await API.window.userGetWindowStatusInfoCreate({ dirIds: [dirId] }, { headers: { workspaceId, ...openAPICommonHeaders } })
      if (code !== 0) {
        return res.error(msg)
      }
      const opened = data.find(item => item.statusInfo.length > 0)
      if (opened) {
        const openUserNames = opened.statusInfo.map(item => item.openUserName).join(', ')
        return res.error(`[${openUserNames}] is using this browser\ndirId: ${dirId}`)
      }
    }
    const result = await API.window.userGetWindowInfoV2List({ dirId, sourceType: 'open' }, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0) {
      const winInfo = result.data.rows[0]
      if (!winInfo) {
        return res.error('window not found')
      }
      if (isUnsupportedCoreForRequest(req, winInfo)) {
        return res.error(getUnsupportedCoreError(winInfo.coreVersion))
      }
      winInfo.startupParam = [winInfo.startupParam, ...args].filter(Boolean).join(';')
      try {
        const launchInfo = await browserManager.launch(winInfo, 'api')
        res.success(launchInfo)
        return
      }
      catch (error) {
        console.error('launch error', error)
        res.error(getErrorMessage(error))
        return
      }
    }
    console.error('userGetWorkspaceListApiList error', result.msg)
    return res.error(result.msg)
  }
  catch (error) {
    console.error('open error', error)
    res.error(error)
  }
})

/** Agent 批量打开浏览器窗口 */
router.post('/agent/open', async (req, res) => {
  const { workspaceId, forceOpen = false, headless = false } = req.body
  const dirIds = resolveOpenDirIds(req.body)
  const layout = (req.body.layout ?? req.body.layoutMode ?? 'stack') as OpenWindowLayout

  if (!dirIds.length) {
    return res.error('dirIds is required')
  }

  if (!['grid', 'stack'].includes(layout)) {
    return res.error('layout must be one of: grid, stack')
  }

  let args: any[]
  try {
    args = normalizeOpenArgs(req.body.args ?? [], headless)
  }
  catch (error) {
    return res.error(error)
  }

  try {
    const pendingDirIds = dirIds.filter(dirId => !browserManager.openedBrowserMap.has(dirId))
    const occupiedResults: Array<{ dirId: string, success: false, status: 'occupied', error: string }> = []

    if (!forceOpen && pendingDirIds.length) {
      const { code, data, msg } = await API.window.userGetWindowStatusInfoCreate({ dirIds: pendingDirIds } as any, { headers: { workspaceId, ...openAPICommonHeaders } })
      if (code !== 0) {
        return res.error(msg)
      }

      for (const item of data) {
        if (item.statusInfo.length > 0) {
          const openUserNames = item.statusInfo.map(status => status.openUserName).join(', ')
          occupiedResults.push({
            dirId: item.dirId,
            success: false,
            status: 'occupied',
            error: `[${openUserNames}] is using this browser\ndirId: ${item.dirId}`,
          })
        }
      }
    }

    const occupiedDirIds = new Set(occupiedResults.map(item => item.dirId))
    const launchDirIds = pendingDirIds.filter(dirId => !occupiedDirIds.has(dirId))
    const customParamsByDirId = layout === 'grid'
      ? buildGridCustomParamsByDirId(dirIds, req.body.layoutOptions ?? req.body.gridOptions)
      : {}

    const result: any = launchDirIds.length
      ? await API.window.userGetWindowInfoV2List(
          { page_index: 1, page_size: 500, isDelete: 0, dirIds: launchDirIds.join(','), sourceType: 'open' } as any,
          { headers: { workspaceId, ...openAPICommonHeaders } },
        )
      : { code: 0, data: { rows: [] }, msg: '' }

    if (result.code !== 0) {
      return res.error(result.msg)
    }

    const winInfoByDirId = new Map<string, any>(result.data.rows.map((item: any) => [item.dirId, item]))
    const occupiedResultMap = new Map<string, any>(occupiedResults.map(item => [item.dirId, item]))
    const rows = await Promise.all(dirIds.map(async (dirId) => {
      if (browserManager.openedBrowserMap.has(dirId)) {
        return getOpenedAgentWindowRow(dirId)
      }

      const runtimeStatus = getAgentOpenRuntimeStatus(dirId)
      if (runtimeStatus) {
        return runtimeStatus
      }

      const occupiedResult = occupiedResultMap.get(dirId)
      if (occupiedResult) {
        return occupiedResult
      }

      const winInfo = winInfoByDirId.get(dirId)
      if (!winInfo) {
        return {
          dirId,
          success: false,
          status: 'core_error' as const,
          error: 'window not found',
        }
      }

      const coreCheck = await prepareAgentLaunchCore(winInfo, req)
      if (!coreCheck.ok) {
        if (coreCheck.status === 'core_downloading') {
          const downloadingStatus = setAgentOpenRuntimeStatus({
            dirId,
            status: coreCheck.status,
            coreType: coreCheck.coreType,
            coreVersion: coreCheck.coreVersion,
            percent: coreCheck.percent,
            downloadStatus: coreCheck.downloadStatus,
          })

          void launchAgentWindowAfterCoreDownload(
            dirId,
            winInfo,
            args,
            customParamsByDirId[dirId],
            coreCheck,
          ).catch((error) => {
            console.error('agent open background launch after core download error', { dirId, error })
          })

          return downloadingStatus
        }

        return {
          dirId,
          success: false,
          status: coreCheck.status,
          error: coreCheck.error,
        }
      }

      try {
        return await launchAgentWindow(dirId, winInfo, args, customParamsByDirId[dirId])
      }
      catch (error) {
        return {
          dirId,
          success: false,
          status: 'launch_error' as const,
          error: getErrorMessage(error),
        }
      }
    }))

    const responseRows = rows.map(serializeAgentOpenRow)
    const openedCount = responseRows.filter(item => item?.status === 'opened').length
    const coreDownloadingCount = responseRows.filter(item => item?.status === 'core_downloading').length
    const launchingCount = responseRows.filter(item => item?.status === 'launching').length
    const failedCount = responseRows.filter(item => item && !item.success && !['core_downloading', 'launching'].includes(item.status)).length

    res.success({
      total: dirIds.length,
      successCount: openedCount,
      failedCount,
      coreDownloadingCount,
      launchingCount,
      rows: responseRows,
    })
  }
  catch (error) {
    console.error('agent open error', error)
    res.error(error)
  }
})

/** 查询 Agent 打开浏览器状态，语义兼容 connection_info */
router.get('/agent/open_status', handleAgentOpenStatus)

/** 关闭浏览器窗口 */
router.post('/close', async (req, res) => {
  const { dirId } = req.body

  if (!dirId) {
    return res.error('dirId is required')
  }

  try {
    await browserManager.batchClose([dirId])
    res.success()
  }
  catch (error) {
    res.error(error)
  }
})

/* 窗口随机指纹 */
router.post('/random_env', async (req, res) => {
  const { dirId, workspaceId } = req.body
  const result = await API.api.userMdfWindowInfoRandomV2Create({ dirId }, { headers: { workspaceId, ...openAPICommonHeaders } })

  return res.json(result)
})

/** 清空窗口本地缓存 */
router.post('/clear_local_cache', async (req, res) => {
  const { dirIds, type = 'all', workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const validTypes = ['partial', 'all', 'cloud'] as const
  if (!validTypes.includes(type)) {
    return res.error('type must be one of: partial, all, cloud')
  }

  if (type === 'cloud' && !workspaceId) {
    return res.error('workspaceId is required when type is cloud')
  }

  try {
    if (type === 'partial') {
      await Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalDataExcludeExtension(dirId)))
    }
    else if (type === 'all') {
      await Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalData(dirId)))
    }
    else if (type === 'cloud') {
      await Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalData(dirId)))
      const result = await API.api.userClearWindowCacheApiV2Create({ dirIds }, { headers: { workspaceId, ...openAPICommonHeaders } })
      if (result.code !== 0) {
        return res.error(result.msg)
      }
    }
    res.success()
  }
  catch (error) {
    console.error('clear_local_cache error', error)
    res.error(error)
  }
})

/** 清空窗口服务器缓存 */
router.post('/clear_server_cache', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const result = await API.api.userClearWindowCacheApiV2Create({ dirIds }, { headers: { workspaceId, ...openAPICommonHeaders } })

  if (result.code === 0) {
    res.success()
  }
  else {
    res.error(result.msg)
  }
})

// 已打开窗口进程信息
router.get('/connection_info', async (req, res) => {
  const { dirIds = '' } = req.query as Record<string, any>

  const dirIdArr = dirIds.split(',').filter(Boolean)

  const result = Array.from(browserManager.openedBrowserMap.values(), browserItem => browserItem.launchInfo)
    .filter(item => dirIdArr.length ? dirIdArr.includes(item.dirId) : true)

  res.success(result)
})

export default router
