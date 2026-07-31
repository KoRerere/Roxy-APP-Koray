import type { AppUpdater, UpdateInfo } from 'electron-updater'
import { GenericProvider } from 'electron-updater/out/providers/GenericProvider'
import type { ProviderRuntimeOptions } from 'electron-updater/out/providers/Provider'
import { parseUpdateInfo } from 'electron-updater/out/providers/Provider'
import { getChannelFilename, newUrlFromBase } from 'electron-updater/out/util'

/** custom provider 传入的配置 */
interface PreservingGenericProviderConfiguration {
  url: string
  channel?: string | null
  provider?: 'generic' | 'custom'
}

/** GenericProvider 内部字段，用于访问父类 private 成员 */
interface GenericProviderInternals {
  baseUrl: URL
  updater: AppUpdater
  configuration: PreservingGenericProviderConfiguration
}

/**
 * 面向网关动态 feed 的 GenericProvider：
 * feed URL 需带 os/cpu 等 query 拉清单，但 yml 内预签名 OSS URL 不能被这些 query 覆盖。
 */
export class PreservingGenericProvider extends GenericProvider {
  /** 仅用于 latest*.yml 请求的 query（如 ?os=darwin&cpu=apple） */
  private readonly feedQuery: string

  /**
   * @param configuration generic provider 配置，url 可含 os/cpu query
   * @param updater electron-updater 实例
   * @param runtimeOptions provider 运行时选项
   */
  constructor(
    configuration: PreservingGenericProviderConfiguration,
    updater: AppUpdater,
    runtimeOptions: ProviderRuntimeOptions,
  ) {
    const feedUrl = new URL(configuration.url)
    const feedQuery = feedUrl.search
    feedUrl.search = ''
    super({ ...configuration, provider: 'generic', url: feedUrl.href }, updater, runtimeOptions)
    this.feedQuery = feedQuery
  }

  /** 解析 channel 名，逻辑与 GenericProvider 一致 */
  private resolveChannel(): string {
    const { updater, configuration } = this as unknown as GenericProviderInternals
    const result = updater.channel || configuration.channel
    return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result)
  }

  /** 拉取 latest*.yml；仅在此步骤附加 feedQuery，不影响 resolveFiles 对预签名 URL 的处理 */
  override async getLatestVersion(): Promise<UpdateInfo> {
    const { baseUrl, updater } = this as unknown as GenericProviderInternals
    const channelFile = getChannelFilename(this.resolveChannel())
    const channelUrl = newUrlFromBase(
      channelFile,
      baseUrl,
      (updater as AppUpdater & { isAddNoCacheQuery?: boolean }).isAddNoCacheQuery,
    )
    if (this.feedQuery) {
      channelUrl.search = this.feedQuery
    }

    for (let attemptNumber = 0; ; attemptNumber++) {
      try {
        return parseUpdateInfo(await this.httpRequest(channelUrl), channelFile, channelUrl)
      }
      catch (error: unknown) {
        const requestError = error as NodeJS.ErrnoException & { statusCode?: number }
        if (requestError.statusCode === 404) {
          throw new Error(
            `Cannot find channel "${channelFile}" update info: ${requestError.stack || requestError.message}`,
          )
        }
        if (requestError.code === 'ECONNREFUSED' && attemptNumber < 3) {
          await new Promise<void>((resolve, reject) => {
            try {
              setTimeout(resolve, 1000 * attemptNumber)
            }
            catch (retryError) {
              reject(retryError)
            }
          })
          continue
        }
        throw error
      }
    }
  }
}

/**
 * 构建 electron-updater custom provider 配置
 * @param feedUrl 含 os/cpu query 的网关 feed 地址
 */
export function buildAppUpdatePublishOptions(feedUrl: string) {
  return {
    provider: 'custom' as const,
    url: feedUrl,
    updateProvider: PreservingGenericProvider,
  }
}
