import type express from 'express'
import twoFactor from 'node-2fa'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API } from '/@/api'
import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import { isPackaged, tryRefreshUrl } from '/@/utils'

export async function setupDashboardServer(app: express.Application) {
  // 工作台
  // 设置静态资源目录
  app.use('/dashboard', async (req, res, next) => {
    const { id = '' } = req.query
    if (isPackaged) {
      const filePath = join(__dirname, './web', 'dashboard.html')

      // 读取 HTML 文件
      try {
        const data = await readFile(filePath, 'utf8')
        // 注入 <script> 标签到 HTML 内容
        const scriptTag = `<script> globalThis.serverPort =  ${store.appPort} </script>`
        /**
         * 在关闭 body 标签之前插入 script 标签
         */
        const modifiedHtml = data.replace('<head>', `<head>${scriptTag}`)

        // 返回修改后的 HTML 文件
        res.send(modifiedHtml)
      }
      catch (error) {
        res.status(500).send('Error reading file')
      }
    }
    else {
      res.redirect(`${import.meta.env.VITE_DEV_SERVER_URL}dashboard?id=${id}&port=${store.appPort}`)
    }
  })

  /* 代理检测 */
  app.get('/api/proxy/detection', async (req, res) => {
    const { dirId } = req.query

    if (!dirId) {
      res.error('dirId is required')
      return
    }

    const browserItem = await browserManager.getOpenedBrowser(dirId as string)

    console.log('browserItem', browserItem)

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
  app.post('/api/proxy/refresh-url', async (req, res) => {
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

  /* 获取浏览器窗口列表 */
  app.get('/api/browser/list', async (req, res) => {
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
  app.get('/api/browser/two_factor_token', async (req, res) => {
    const { code } = req.query as Record<string, any>
    try {
      const { token } = twoFactor.generateToken(code)
      res.success(token)
    }
    catch (error) {
      res.error(error)
    }
  })
}
