import { genRandomFingerprint } from '@roxy/shared'
import { screen } from 'electron'
import express from 'express'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { browserManager, coreManager } from '/@/modules/browser'
import { registerChunkLayoutReflowShortcut, setChunkLayoutSnapshot } from '/@/modules/browser/browser-manager/chunkLayoutReflow'
import { accountMapping, browserListMapping, browserListMappingV2, browserListMappingV3, mapping2List } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { getErrorMessage, getLocalFonts, getMacAddress } from '/@/utils'
import { buildChunkLaunchParamsByDirId, computeWindowGridLayouts, sortDisplaysSpatial } from '/@/utils/windowGridLayout'
import { getDefaultBrowserCreateParams } from './constants/'

const router = express.Router()

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
  if (!Array.isArray(args))
    throw new Error('args is not array')

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

async function prepareAgentLaunchCore(winInfo: any): Promise<AgentLaunchCoreCheckResult> {
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

/* 创建窗口 */
router.post('/create', async (req, res) => {
  const { proxyInfo = {}, windowPlatformList = [], fingerInfo = {}, workspaceId, coreType, coreVersion } = req.body || {}

  // 根据用户传入的 coreType / coreVersion 校验当前系统可用内核，缺省时回落为最新版本
  const coreResult = await coreManager.resolveCoreParams(coreType, coreVersion, { fillDefaults: true })
  if (!coreResult.ok) {
    return res.error(coreResult.error)
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
  const { proxyInfo = {}, windowPlatformList = [], fingerInfo = {}, workspaceId } = req.body || {}

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

      const coreCheck = await prepareAgentLaunchCore(winInfo)
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
