import express from 'express'
import { browserManager } from '/@/modules/browser'

const router = express.Router()

/* GET home page. */
router.get('/console', async (req, res) => {
  const { id } = req.query

  if (!id) {
    res.status(400).send('id is required')
    return
  }

  const browserItem = await browserManager.getOpenedBrowser(id as string)

  console.log('browserItem', browserItem)

  if (!browserItem) {
    res.status(400).send('browser not found')
    return
  }

  try {
    const proxyInfo = await browserItem.proxyDetection()

    res.send({
      dirId: id,
      ...proxyInfo,
    })
  }
  catch (error) {
    res.send({
      dirId: id,
      data: '代理检测失败',
    })
    console.log('proxyDetection error', error)
  }
})

export default router
