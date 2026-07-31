import type { UserGetCoreUpgradeCreateData } from '@roxy/backend-api'
import type { AxiosResponse } from 'axios'
import { isEqual } from 'es-toolkit'
import { isCoreVersionListChanged, parseHeaderParams } from './util'

interface CoreVersionCheckerOptions {
  /** 日志前缀，便于区分 Chrome / Firefox */
  logPrefix: string
  /** 响应头字段名 */
  headerName: string
  /** 获取本地已缓存的内核版本列表 */
  getLastCoreVersionList: () => Record<string, string>
  /** 拉取远端内核列表 */
  fetchAvailableCoreList: () => Promise<UserGetCoreUpgradeCreateData>
}

/** 创建基于响应头的内核版本检查器 */
export function createCoreVersionChecker(options: CoreVersionCheckerOptions) {
  let isCheckingCoreVersion = false
  /** 已成功 fetch 过的 header 快照，与 lastCoreVersionList 解耦，避免两端数据不一致时反复拉取 */
  let lastProcessedHeaderList: Record<string, string> = {}
  /** fetch 进行中收到的新 header，待当前 fetch 结束后补跑 */
  let pendingHeaderList: Record<string, string> | null = null

  /** 串行拉取内核列表，避免并发 fetch 互相覆盖 */
  function scheduleFetch(headerList: Record<string, string>) {
    if (isCheckingCoreVersion) {
      pendingHeaderList = headerList
      return
    }

    isCheckingCoreVersion = true
    pendingHeaderList = null

    console.info(options.logPrefix, headerList, options.getLastCoreVersionList())

    options.fetchAvailableCoreList()
      .then((result) => {
        // 以 header 为准标记已处理：fetch 接口与响应头可能不同步，不能依赖 lastCoreVersionList 对齐后再停
        if (result.code === 0) {
          lastProcessedHeaderList = headerList
        }
      })
      .finally(() => {
        isCheckingCoreVersion = false
        const pending = pendingHeaderList
        pendingHeaderList = null
        if (pending) {
          retryPendingFetch(pending)
        }
      })
  }

  /** fetch 结束后补跑排队中的 header 变更 */
  function retryPendingFetch(pending: Record<string, string>) {
    if (isEqual(lastProcessedHeaderList, pending)) {
      return
    }

    if (!shouldFetchForHeader(pending)) {
      return
    }

    scheduleFetch(pending)
  }

  /** 判断当前 header 是否仍需触发 fetch */
  function shouldFetchForHeader(headerList: Record<string, string>) {
    if (isEqual(lastProcessedHeaderList, headerList)) {
      return false
    }

    const lastVersionList = options.getLastCoreVersionList()
    if (!isCoreVersionListChanged(headerList, lastVersionList)) {
      // 本地已与 header 对齐，仅同步 header 缓存，避免每次 API 响应重复比对
      lastProcessedHeaderList = headerList
      return false
    }

    return true
  }

  return async function checkCoreVersion(response: AxiosResponse<any, any>) {
    const headerValue = response.headers[options.headerName]
    if (!headerValue) {
      return
    }

    let headerList: Record<string, string> = {}
    try {
      headerList = parseHeaderParams(
        Array.isArray(headerValue) ? headerValue[0] : headerValue,
      )
    }
    catch (error) {
      console.error(`${options.logPrefix} parseHeaderParams error`, error)
      return
    }

    if (!shouldFetchForHeader(headerList)) {
      return
    }

    scheduleFetch(headerList)
  }
}
