import express from 'express'
import { browserManager } from '/@/modules/browser'
import { tryRefreshUrl } from '/@/utils'

const router = express.Router()

/* 代理检测 */
router.get('/detection', async (req, res) => {
  const { dirId } = req.query

  if (!dirId) {
    res.error('dirId is required')
    return
  }

  const browserItem = await browserManager.getOpenedBrowser(dirId as string)

  // console.log('browserItem', browserItem)

  if (!browserItem) {
    res.error('browser not found')
    return
  }

  try {
    const proxyInfo = await browserItem.proxyDetection()

    res.success(proxyInfo)
  }
  catch (error) {
    res.error('代理检测失败')
    console.log('proxyDetection error', error)
  }
})

/* 代理 => 刷新 URL */
router.post('/refresh-url', async (req, res) => {
  const { refreshUrl } = req.body
  console.log('refreshUrl', refreshUrl)
  try {
    const result = await tryRefreshUrl(refreshUrl)
    res.success(result)
  }
  catch (error) {
    res.error('刷新 URL 失败')
    console.log('refreshUrl error', error)
  }
})

export default router
