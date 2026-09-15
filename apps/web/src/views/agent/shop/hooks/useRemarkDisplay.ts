import { debounce } from 'es-toolkit'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'

/** 备注列表头/单元格共用的列缓存，extend 控制备注正文是否展开 */
export interface RemarkColumnCache {
  extend?: boolean
}

/**
 * 切换备注列展开，并在与账号配置不一致时写回服务端。
 * 主列表与选择弹窗共用同一 remarkDisplayStatus，避免两处偏好互相覆盖。
 */
export function useRemarkDisplay() {
  const { userConfig } = storeToRefs(useUserStore())
  const { fetchUserInfo, updateUserConfig } = useUserStore()
  const [_, onlyErrorToast] = useResponseToast()

  /** 把展开状态同步到用户配置，500ms 内连点只打一次接口 */
  const persistRemarkDisplayStatus = debounce(async (remarkDisplayStatus: boolean) => {
    const { code, msg } = await API.base.userSetUserConfigCreate({
      remarkDisplayStatus,
    } as any)
    onlyErrorToast(code, msg)
    if (code !== 0) {
      return
    }
    fetchUserInfo()
    updateUserConfig()
  }, 500)

  /** 翻转当前列表的展开标记；仅在与账号偏好不同时才请求后端 */
  function toggleRemarkDisplayStatus(cache: RemarkColumnCache) {
    cache.extend = !cache.extend
    if (userConfig.value.remarkDisplayStatus !== cache.extend) {
      persistRemarkDisplayStatus(cache.extend)
    }
  }

  return { toggleRemarkDisplayStatus }
}
