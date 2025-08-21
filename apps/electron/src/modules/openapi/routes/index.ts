import type { Application } from 'express'
import { store } from '/@/modules/store'
import browserRouter from './browser'
import { API } from '/@/api'

const notNeedTokenRoutes = [
  '/health',
]

const notNeedWorkspaceIdRoutes = [
  '/proxy',
  '/browser/two-factor-token',
  '/browser/connection_info',
  '/browser/close',
  '/browser/open',
  '/browser/workspace',
  '/browser/clear_local_cache',
  '/user/info',
  '/user/config',
]

export function setupRoutes(app: Application) {
  app.use(async (req, res, next) => {
    res.header('Connection', 'close')
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
    res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE')

    // 如果不是白名单路由，需要校验 token
    if (!notNeedTokenRoutes.some(n => req.path.startsWith(n))) {
      if (req.header(`token`) !== store.apiKey) {
        return res.error($t('无效的 token'))
      }

      // 如果不是白名单路由，需要校验 workspaceId
      if (!notNeedWorkspaceIdRoutes.some(n => req.path.startsWith(n))) {
        const { workspaceId } = req.method === 'GET' ? req.query : req.body
        if (!workspaceId) {
          return res.error('workspaceId is required')
        }
      }
    }

    next()
  })

  // 浏览器健康检查
  app.use('/health', (req, res) => {
    res.success('ok')
  })

  /** 获取当前用户信息 */
  app.use('/user/info', (req, res) => {
    res.success(store.userInfo)
  })

  /** 更新用户软件配置 */
  app.use('/user/config', async (req, res) => {
    res.json(await API.base.userSetUserConfigCreate(req.body))
  })

  app.use('/browser', browserRouter)

  app.use((req, res) => {
    res.status(404).send('Not Found')
  })
}
