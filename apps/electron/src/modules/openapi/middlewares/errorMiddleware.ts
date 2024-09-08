import type { NextFunction, Request, Response } from 'express'

/**
 * https://expressjs.com/en/guide/error-handling.html
 * 错误处理中间件函数的定义方式与其他中间件函数相同，只是错误处理函数有四个参数而不是三个： (err, req, res, next)
 */
export function errorMiddleware(err: Error, req: Request, res: Response, _: NextFunction) {
  res.error(err)
}
