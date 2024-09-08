import { join } from 'node:path'
import bodyParser from 'body-parser'
import express from 'express'
import { errorMiddleware } from './errorMiddleware'
import { responseMiddleware } from './responseMiddleware'
import { isPackaged } from '/@/utils'

export function setupMiddlewares(app: express.Application) {
  // 工作台
  const staticMiddleware = express.static(join(__dirname, './web'), { index: 'dashboard.html' })
  // 设置静态资源目录
  app.use('/dashboard', (req, res, next) => {
    const { id = '' } = req.query
    if (isPackaged) {
      staticMiddleware(req, res, next)
    }
    else {
      res.redirect(`${import.meta.env.VITE_DEV_SERVER_URL}dashboard?id=${id}`)
    }
  })
  // 使用 body-parser 中间件解析 JSON 和 URL-encoded 数据
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  // 跨域设置 enable cors
  app.use((req, res, next) => {
    // $LOG(`req header`, req.path, req.header(`token`))

    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
    res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE')

    // if (this.intercept(req)) {
    //   return res.json({
    //     code: 500,
    //     msg: `token错误`,
    //   });
    // }
    next()
  })

  // 统一响应结果的中间件
  app.use(responseMiddleware)
  // 错误处理中间件最后加载，放在所有路由之后
  setTimeout(() => {
    app.use(errorMiddleware)
  })
}
