/** 基础错误类 */
export class BaseError extends Error {
  constructor(
    message: string,
    public code: number = 500,
    public cause?: any,
  ) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** 插件相关错误 */
export class ExtensionError extends BaseError {
  constructor(
    message: string,
    public pluginId: string,
    public pluginName: string,
    code: number = 500,
    cause?: any,
  ) {
    super(message, code, cause)
  }
}

/** 插件下载错误 */
export class ExtensionDownloadError extends ExtensionError {
  constructor(
    pluginId: string,
    pluginName: string,
    cause?: any,
  ) {
    super(
      `扩展 ${pluginName} 下载失败`,
      pluginId,
      pluginName,
      400,
      cause,
    )
  }
}

/** 插件验证错误 */
export class ExtensionValidationError extends ExtensionError {
  constructor(
    pluginId: string,
    pluginName: string,
    cause?: any,
  ) {
    super(
      $t('插件校验失败，请联系客服'),
      pluginId,
      pluginName,
      403,
      cause,
    )
  }
}

/** 插件安装错误 */
export class ExtensionInstallError extends ExtensionError {
  constructor(
    pluginId: string,
    pluginName: string,
    cause?: any,
  ) {
    super(
      `扩展 ${pluginName} 安装失败`,
      pluginId,
      pluginName,
      500,
      cause,
    )
  }
}

/** 插件更新错误 */
export class ExtensionUpdateError extends ExtensionError {
  constructor(
    pluginId: string,
    pluginName: string,
    cause?: any,
  ) {
    super(
      `扩展 ${pluginName} 更新失败`,
      pluginId,
      pluginName,
      500,
      cause,
    )
  }
}

/** 插件删除错误 */
export class ExtensionDeleteError extends ExtensionError {
  constructor(
    pluginId: string,
    pluginName: string,
    cause?: any,
  ) {
    super(
      `扩展 ${pluginName} 删除失败`,
      pluginId,
      pluginName,
      500,
      cause,
    )
  }
}
