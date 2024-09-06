import { join } from 'node:path'
import express from 'express'
import { browserManager } from '/@/modules/browser'
import { isPackaged } from '/@/utils'

const router = express.Router()

/* 代理检测 */
router.get('/proxy/detection', async (req, res) => {
  const { dirId } = req.query

  if (!dirId) {
    res.status(400).send('dirId is required')
    return
  }

  const browserItem = await browserManager.getOpenedBrowser(dirId as string)

  console.log('browserItem', browserItem)

  if (!browserItem) {
    res.status(400).send('browser not found')
    return
  }

  try {
    const proxyInfo = await browserItem.proxyDetection()

    res.send({
      dirId,
      ...proxyInfo,
    })
  }
  catch (error) {
    res.send({
      dirId,
      data: '代理检测失败',
    })
    console.log('proxyDetection error', error)
  }
})

export default router
