import { watch } from 'vue'
import { fetchDefaultWindowName } from '../utils'
import { buildSuggestedWindowName, fetchPlatformAbbrCatalog } from '../window-name'

/** 建议名写在名称输入项上，提交时读取，不直接改 value */
interface SuggestedNameInput {
  dirId?: string
  placeholder?: string
  suggestedWindowName?: string
}

/** 由调用方决定何时启用，以及从哪张表单读取账号和代理 */
interface UseSuggestedWindowNameOptions {
  enabled: () => boolean
  getNameInput: () => SuggestedNameInput | undefined
  getAccounts: () => unknown
  getProxyList: () => unknown
  /** 批量创建只保留日期序号，后端暂不接受平台缩写和代理国家前缀 */
  serialOnly?: boolean
}

/**
 * 把建议窗口名同步到 placeholder。
 * 单个创建带平台缩写和代理国家；批量创建只写日期序号。
 */
export function useSuggestedWindowName(options: UseSuggestedWindowNameOptions) {
  /** 同一张表单复用日期序号，避免代理或账号一变就重复请求 */
  let serialTask: Promise<string | undefined> | undefined
  /** 平台库与表单无关，组件存活期间只拉一次 */
  let catalogTask: ReturnType<typeof fetchPlatformAbbrCatalog> | undefined
  /** 连续回写时丢弃过期结果，避免旧序号盖住新表单 */
  let fillSeq = 0

  watch(
    () => options.enabled() ? options.getNameInput() : undefined,
    (input, prev) => {
      if (input !== prev) {
        serialTask = undefined
      }
      void syncSuggestedWindowName()
    },
    { immediate: true },
  )

  watch(
    () => {
      if (!options.enabled() || options.serialOnly) {
        return undefined
      }
      return [options.getProxyList(), options.getAccounts()] as const
    },
    () => {
      void syncSuggestedWindowName()
    },
    { deep: true },
  )

  /**
   * 建议名只写入 placeholder，不预填 value。
   * 平台缩写和代理国家码分开判断。
   */
  async function syncSuggestedWindowName() {
    if (!options.enabled()) {
      return
    }

    const input = options.getNameInput()
    if (!input || input.dirId) {
      return
    }

    const seq = ++fillSeq
    // 从单个创建切过来时，先丢掉带前缀的建议名，避免批量提交仍带上平台或国家
    if (options.serialOnly) {
      input.suggestedWindowName = ''
    }
    serialTask ??= fetchDefaultWindowName()
    if (!options.serialOnly) {
      catalogTask ??= fetchPlatformAbbrCatalog()
    }
    const [serial, catalog] = await Promise.all([serialTask, catalogTask ?? Promise.resolve([])])
    if (seq !== fillSeq || options.getNameInput() !== input || !options.enabled() || input.dirId || !serial) {
      return
    }

    const name = options.serialOnly
      ? serial
      : buildSuggestedWindowName(serial, {
          accounts: options.getAccounts() as Array<{ platformUrl?: string, platformAbbr?: string }> | undefined,
          proxyList: options.getProxyList(),
        }, catalog)
    input.placeholder = name
    input.suggestedWindowName = name
  }
}
