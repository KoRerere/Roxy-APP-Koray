import type express from 'express'
import bodyParser from 'body-parser'
import { errorMiddleware } from './errorMiddleware'
import { responseMiddleware } from './responseMiddleware'

export function setupMiddlewares(app: express.Application) {
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
    res.setHeader('Access-Control-Allow-Private-Network', 'true')

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
