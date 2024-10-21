import express from 'express'
import twoFactor from 'node-2fa'
import { API } from '/@/api'
import { browserManager } from '/@/modules/browser'
import { genRandomFingerprint } from '/@/utils/randomFingerprint'
import { defaultBrowserCreateParams } from './constants/'

const router = express.Router()

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

    const result = await API.window.userAddWindowInfoCreate({
      ...params,
      ...data,
    }, {
      headers: {
        workspaceId,
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

  const result = await API.window.userMdfWindowInfoSingleCreate(params, {
    headers: {
      workspaceId,
    },
  })
  res.json(result)
})

/* 获取浏览器窗口列表 */
router.get('/list', async (req, res) => {
  const { page_index = 1, page_size = 15, dirId, workspaceId } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoV2List({ page_index, page_size, dirId }, { headers: { workspaceId } })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 获取 2fa */
router.get('/two_factor_token', async (req, res) => {
  const { code } = req.query as Record<string, any>
  try {
    const { token } = twoFactor.generateToken(code)
    res.success(token)
  }
  catch (error) {
    res.error(error)
  }
})

/* 删除窗口 */
router.post('/delete', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  try {
    const result = await API.api.userDelWindowInfoApiV2Create({ dirIds }, { headers: { workspaceId } })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/** 打开浏览器窗口 */
router.post('/open', async (req, res) => {
  const { dirId, args = [] } = req.body

  if (!dirId) {
    return res.error('dirId is required')
  }

  if (!Array.isArray(args)) {
    return res.error('args is required')
  }

  if (browserManager.openedBrowserMap.has(dirId)) {
    return res.error('browser is already opened')
  }

  try {
    const result = await API.window.userGetWindowInfoV2List({ dirId })
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
    res.success(null)
  }
  catch (error) {
    res.error(error)
  }
})

/* 窗口随机指纹 */
router.post('/random_env', async (req, res) => {
  const { dirId, workspaceId } = req.body
  const result = await API.api.userMdfWindowInfoRandomV2Create({ dirId }, { headers: { workspaceId } })

  return res.json(result)
})

/** 清空窗口本地缓存 */
router.post('/clear_local_cache', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const result = await API.window.userGetWindowInfoV2List({ dirIds: dirIds.join(',') }, { headers: { workspaceId } })

  if (result.code === 0) {
    const promiseArr = result.data.rows.map(winInfo => browserManager.removeLocalData(winInfo, winInfo.workspaceId || workspaceId))
    res.success(await Promise.all(promiseArr))
  }
  else {
    res.error(result.msg)
  }
})

/** 清空窗口服务器缓存 */
router.post('/clear_server_cache', async (req, res) => {
  const { dirIds, workspaceId } = req.body

  if (!Array.isArray(dirIds)) {
    return res.error('dirIds is required')
  }

  const result = await API.api.userClearWindowCacheApiV2Create({ dirIds }, { headers: { workspaceId } })

  if (result.code === 0) {
    res.success(result)
  }
  else {
    res.error(result.msg)
  }
})

router.get('/connection_info', async (req, res) => {
  res.success([...browserManager.openedBrowserMap.values()].map(browserItem => browserItem.launchInfo))
})

export default router
