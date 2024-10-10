import express from 'express'
import twoFactor from 'node-2fa'
import { API } from '/@/api'
import { defaultBrowserCreateParams } from './constants/'
import { randomFingerprint } from './util'

const router = express.Router()

/* 创建窗口 */
router.get('/create', async (req, res) => {
  const { proxyInfo = {}, fingerInfo = {} } = req.body || {}
  const params = {
    ...defaultBrowserCreateParams,
    ...req.body,
    ...proxyInfo,
    ...fingerInfo,
  }

  try {
    const data = await randomFingerprint(params)

    const result = await API.window.userAddWindowInfoCreate(data)
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

// 修改窗口
router.post('mdf', async (req, res) => {
  const { proxyInfo = {}, fingerInfo = {} } = req.body || {}
  const params = {
    ...req.body,
    ...proxyInfo,
    ...fingerInfo,
  }

  const result = await API.window.userMdfWindowInfoSingleCreate(params)
  res.json(result)
})

/* 获取浏览器窗口列表 */
router.get('/list', async (req, res) => {
  const { page_index = 1, page_size = 15, dirId } = req.query as Record<string, any>
  try {
    const result = await API.window.userGetWindowInfoV2List({ page_index, page_size, dirId })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 获取浏览器窗口列表 */
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

export default router
