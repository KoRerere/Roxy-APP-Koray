import type { NextFunction, Request, Response } from 'express'
import { getErrorMessage } from '/@/utils'

export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  /**
   * 统一的成功响应
   */
  res.success = (data, msg = '成功') => {
    res.json({
      code: 0,
      msg,
      data,
    })
  }

  /**
   * 统一的错误响应
   */
  res.error = (msg = 'error', code = 101) => {
    res.json({
      code,
      msg: getErrorMessage(msg),
      data: null,
    })
  }

  next()
}
