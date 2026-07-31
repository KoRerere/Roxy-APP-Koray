import type express from 'express'
import twoFactor from 'node-2fa'
import { browserManager } from '/@/modules/browser'
import { setUserConfig, store } from '/@/modules/store'
import { calculateRemainingTime, tryRefreshUrl } from '/@/utils'

/** 注册 dashboard 内部使用的所有 /api/* 路由。 */
export function registerDashboardApiRoutes(app: express.Application) {
  /* 获取 app 设置 */
  app.get('/api/app/config', async (req, res) => {
    const { dirId } = req.query
    const browserItem = await browserManager.getOpenedBrowser(dirId as string)

    const isIPV6 = browserItem?.winInfo.ipType === 'IPV6'

    res.success({
      appPort: store.appPort,
      language: store.language,
      ipChecker: isIPV6 ? store.lastUseIp2locationUrl : store.ipChecker,
      dashboardTourGuide: store.dashboardTourGuide,
      // 优先用启动时写入 winInfo 的类型，避免用户切空间后工作台文案错位
      workspaceType: store.workspaceType ?? 0,
    })
  })

  app.post('/api/dashboard/close-tour-guide', async (req, res) => {
    setUserConfig({ dashboardTourGuide: true })
    res.success({
      code: 0,
      msg: 'success',
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
      const proxyInfo = await browserItem.proxyDetection(true)
      res.success(proxyInfo)
    }
    catch (error) {
      res.error('proxy detection failed')
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
      res.error('refresh url failed')
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
      const tokenResult = twoFactor.generateToken(code)
      if (!tokenResult) {
        res.error('two factor token generate failed')
        return
      }

      const { token } = tokenResult
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
}
