import type express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import twoFactor from 'node-2fa'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API } from '/@/api'
import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import { calculateRemainingTime, fileExists, isPackaged, tryRefreshUrl } from '/@/utils'
import { appConfig } from '/@/constants'

export async function setupDashboardServer(app: express.Application) {
  // 工作台
  // 设置静态资源目录
  // app.use('/dashboard', async (req, res, next) => {
  //   const { id = '' } = req.query
  //   if (isPackaged) {
  //     const filePath = join(__dirname, './web', 'dashboard.html')

  //     // 读取 HTML 文件
  //     try {
  //       const data = await readFile(filePath, 'utf8')
  //       // 注入 <script> 标签到 HTML 内容
  //       const scriptTag = `<script> globalThis.serverPort =  ${store.appPort} </script>`
  //       /**
  //        * 在关闭 body 标签之前插入 script 标签
  //        */
  //       const modifiedHtml = data.replace('<head>', `<head>${scriptTag}`)

  //       // 返回修改后的 HTML 文件
  //       res.send(modifiedHtml)
  //     }
  //     catch (error) {
  //       res.status(500).send('Error reading file')
  //     }
  //   }
  //   else {
  //     res.redirect(`${import.meta.env.VITE_DEV_SERVER_URL}dashboard?id=${id}&port=${store.appPort}`)
  //   }
  // })

  /* 获取 app 设置 */
  app.get('/api/app/config', async (req, res) => {
    res.success({
      appPort: store.appPort,
      language: store.language,
    })
  })

  /* 代理检测 */
  app.get('/api/proxy/detection', async (req, res) => {
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
      proxyInfo.detectionChannel = store.ipChecker
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
    const { dirId } = req.query as Record<string, any>
    try {
      const browserItem = await browserManager.getOpenedBrowser(dirId as string)
      res.success(browserItem?.winInfo)
    }
    catch (error) {
      res.error(error)
    }
  })

  /* 获取 2fa */
  app.get('/api/browser/two-factor-token', async (req, res) => {
    const { code } = req.query as Record<string, any>
    try {
      const { token } = twoFactor.generateToken(code)
      const remainingTime = calculateRemainingTime()
      res.success({
        token,
        remainingTime,
      })
    }
    catch (error) {
      res.error(error)
    }
  })

  /** 获取当前内核信息 */
  app.get('/api/browser/core-info', async (req, res) => {
    console.log('/api/browser/core-info', req.query)
    const { dirId } = req.query
    const browserItem = await browserManager.getOpenedBrowser(dirId as string)
    return res.success(browserItem?.coreVersion)
  })

  if (isPackaged) {
    app.use('/dashboard', async (req, res, next) => {
      const { id = '' } = req.query
      const isUseExternal = store.isExternalWeb && await fileExists(join(appConfig.externalWebDir, 'dashboard.html'))
      const filePath = join(isUseExternal ? appConfig.externalWebDir : appConfig.buildInWebDir, 'dashboard.html')
      const browserItem = await browserManager.getOpenedBrowser(id as string)

      try {
        const data = await readFile(filePath, 'utf8')
        // const docTitle = `${browserItem?.winInfo.windowSortNum}-${browserItem?.winInfo.windowName}-${$t('工作台')}`
        const modifiedHtml = data.replace(/<title>(.*?)<\/title>/, `<title>${$t('工作台')}</title>`)
        res.send(modifiedHtml)
      }
      catch (error) {
        console.log('store.isExternalWeb', store.isExternalWeb, filePath)
        console.log('/dashboard error', error)
        res.status(500).send(`Error reading file: ${error}`)
      }
    })
  }
  else {
    app.use(createProxyMiddleware({
      target: import.meta.env.VITE_DEV_SERVER_URL,
      changeOrigin: true,
      selfHandleResponse: true, // 让代理处理响应
      on: {
        proxyRes(proxyRes, req, res) {
          const chunks: Buffer[] = []
          proxyRes.on('data', (chunk) => {
            chunks.push(chunk)
          })

          proxyRes.on('end', () => {
            const body = Buffer.concat(chunks)
            const contentType = proxyRes.headers['content-type']
            if (contentType?.includes('text/html')) {
              const { id = '' } = req.query
              let bodyString = body.toString()
              browserManager.getOpenedBrowser(id as string).then(browserItem => {
                // const docTitle = `${browserItem?.winInfo.windowSortNum}-${browserItem?.winInfo.windowName}-${$t('工作台')}`
                // 修改 HTML 响应体中的 <title> 标签
                bodyString = bodyString.replace(/<title>(.*?)<\/title>/, `<title>${$t('工作台')}</title>`)
                // 确保响应内容完整
                proxyRes.headers['content-length'] = String(Buffer.byteLength(bodyString));
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
                res.end(bodyString)
              })
            }
            else {
              // 处理其他类型的响应
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
              res.end(body)
            }
          })
        },
      },
    }))
  }
}
