import express from 'express'
import { API } from '/@/api'
import { browserManager } from '/@/modules/browser'
import { accountMapping, listTrans } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { genRandomFingerprint } from '/@/utils/randomFingerprint'
import { defaultBrowserCreateParams } from './constants/'

const router = express.Router()

const commonHeaders = {
  source: 'api',
}

/** 获取账号列表 */
router.get('/account', async (req, res) => {
  const { workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.platform.userGetPlatformInfoV2List({ ...rest }, { headers: { workspaceId, ...commonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(accountMapping, result.data.rows)
    }
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
    const result = await API.api.userGetWorkspaceListApiList({ ...rest }, { headers: { ...commonHeaders } })
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
  const { proxyInfo = {}, fingerInfo = {}, workspaceId } = req.body || {}
  const params = {
    ...defaultBrowserCreateParams,
    ...req.body,
    ...proxyInfo,
    ...fingerInfo,
  }

  try {
    const data = await genRandomFingerprint(params)

    const result = await API.window.userAddWindowInfoV2Create({
      ...params,
      ...data,
    }, {
      headers: {
        workspaceId,
        ...commonHeaders,
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
  const { proxyInfo = {}, fingerInfo = {}, workspaceId } = req.body || {}
  const params = {
    ...req.body,
    ...proxyInfo,
    ...fingerInfo,
  }

  const result = await API.window.userMdfWindowInfoSingleV2Create(params, {
    headers: {
      workspaceId,
      ...commonHeaders,
    },
  })
  res.json(result)
})

/* 获取浏览器窗口列表 */
router.get('/list', async (req, res) => {
  const { dirId, workspaceId, ...rest } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoV2List({ dirId, ...rest }, { headers: { workspaceId, ...commonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      console.log('browserListMapping', result.data.rows)
      result.data.rows = result.data.rows.map(item => listTrans(item))
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 删除窗口 */
router.post('/delete', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  try {
    const result = await API.api.userDelWindowInfoApiV2Create({ dirIds }, { headers: { workspaceId, ...commonHeaders } })
    dirIds.forEach(dirId => browserManager.removeLocalData(dirId))

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 打开浏览器窗口 */
router.post('/open', async (req, res) => {
  const { dirId, workspaceId, args = [] } = req.body

  if (!dirId) {
    return res.error('dirId is required')
  }

  if (!Array.isArray(args)) {
    return res.error('args is required')
  }

  if (browserManager.openedBrowserMap.has(dirId)) {
    res.success(browserManager.openedBrowserMap.get(dirId)?.launchInfo, 'browser is already opened')
    return
  }

  try {
    const result = await API.window.userGetWindowInfoV2List({ dirId }, { headers: { workspaceId, ...commonHeaders } })
    if (result.code === 0) {
      const winInfo = result.data.rows[0]
      if (!winInfo) {
        return res.error('window not found')
      }
      winInfo.startupParam = [winInfo.startupParam, ...args].join(',')
      try {
        const launchInfo = await browserManager.launch(winInfo)
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
    await browserManager.close(dirId)
    res.success()
  }
  catch (error) {
    res.error(error)
  }
})

/* 窗口随机指纹 */
router.post('/random_env', async (req, res) => {
  const { dirId, workspaceId } = req.body
  const result = await API.api.userMdfWindowInfoRandomV2Create({ dirId }, { headers: { workspaceId, ...commonHeaders } })

  return res.json(result)
})

/** 清空窗口本地缓存 */
router.post('/clear_local_cache', async (req, res) => {
  const { dirIds } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const promiseArr = dirIds.map(dirId => browserManager.removeLocalData(dirId))
  try {
    await Promise.all(promiseArr)
  }
  catch (error) {
    console.error('clear_local_cache error', error)
  }
  finally {
    res.success()
  }
})

/** 清空窗口服务器缓存 */
router.post('/clear_server_cache', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const result = await API.api.userClearWindowCacheApiV2Create({ dirIds }, { headers: { workspaceId, ...commonHeaders } })

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

  const dirIdArr = dirIds.split(',')

  const result = [...browserManager.openedBrowserMap.values()]
    .map(browserItem => browserItem.launchInfo)
    .filter(item => dirIdArr.length ? dirIdArr.includes(item.dirId) : true)

  res.success(result)
})

export default router
