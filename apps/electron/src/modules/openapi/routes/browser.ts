import { genRandomFingerprint } from '@roxy/shared'
import express from 'express'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { browserManager, coreManager } from '/@/modules/browser'
import { accountMapping, browserListMapping, browserListMappingV2, browserListMappingV3, mapping2List } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { getLocalFonts, getMacAddress } from '/@/utils'
import { getDefaultBrowserCreateParams } from './constants/'

const router = express.Router()

// sourceType 后端用于区分来源的字段

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
        res.error(error.message)
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
  console.log('connection_info dirIdArr', dirIdArr)

  const result = Array.from(browserManager.openedBrowserMap.values(), browserItem => browserItem.launchInfo)
    .filter(item => dirIdArr.length ? dirIdArr.includes(item.dirId) : true)

  res.success(result)
})

export default router
