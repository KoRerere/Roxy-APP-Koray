import { join } from 'node:path'
import express from 'express'
import { browserManager } from '/@/modules/browser'
import { isPackaged } from '/@/utils'

const router = express.Router()

/* GET home page. */
router.get('/dashboard', async (req, res) => {
  const { id } = req.query

  if (!id) {
    res.status(400).send('id is required')
    return
  }

  if (isPackaged) {
    res.sendFile(join(__dirname, './web/dashboard.html'))
    return
  }
  else {
    return res.redirect(`${import.meta.env.VITE_DEV_SERVER_URL}dashboard/index.html?id=${id}`)
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
