import type { NextFunction, Request, Response } from 'express'
import { getErrorMessage } from '/@/utils'

export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  /**
   * 统一的成功响应
   */
  res.success = (data, message = 'success') => {
    res.json({
      code: 0,
      message,
      data,
    })
  }

  /**
   * 统一的错误响应
   */
  res.error = (message = 'error', code = 1) => {
    res.json({
      code,
      message: getErrorMessage(message),
      data: null,
    })
  }

  next()
}
