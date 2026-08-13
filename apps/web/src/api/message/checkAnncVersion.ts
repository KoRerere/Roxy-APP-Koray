import type { AxiosResponse } from 'axios'
import { useSimpleLocale } from '/@/stores/locale'
import { useCommonStore } from '/@/stores/common'
import { useWorkspaceStore } from '/@/stores/workspace'

// r-annc_v en=xxx;zh=xxx;ru=xxx;...

/** 上一次版本（按 workspace 维度，切换后重置） */
let lastVersion = 0
/** 版本比对所绑定的 workspace 键，避免跨空间误用旧版本 */
let lastVersionWorkspaceKey = ''
let isCheckingAppVersion = false

/** 用 workspaceId + workspaceType 区分普通/电商模式下的公告版本 */
function getAnncWorkspaceKey() {
  const workspaceStore = useWorkspaceStore()
  // silent 仅准备 header，与进空间副作用一致：正式进空间后再跟版本
  if (!workspaceStore.currentWorkspace?.id || workspaceStore.workspaceEntrySilent)
    return ''
  return `${workspaceStore.currentWorkspace.id}:${workspaceStore.currentWorkspace.workspaceType ?? ''}`
}

export async function checkAnncVersion(response: AxiosResponse<any, any>) {
  if (isCheckingAppVersion || typeof response.headers.r_annc_v !== 'string') {
    return
  }

  // 公告依赖请求头 workspaceId，登录早期 / silent 尚未正式进空间时跳过
  const workspaceKey = getAnncWorkspaceKey()
  if (!workspaceKey)
    return

  if (workspaceKey !== lastVersionWorkspaceKey) {
    lastVersion = 0
    lastVersionWorkspaceKey = workspaceKey
  }

  isCheckingAppVersion = true

  const simpleLocaleStore = useSimpleLocale()
  const { fetchAnntList } = useCommonStore()

  const remoteVersions = response.headers.r_annc_v.split(';').map((item: string) => item.split('='))
  const remoteVersion = Number(remoteVersions?.find(([locale]: string[]) => simpleLocaleStore.currentLocale.startsWith(locale))?.[1])

  if (!remoteVersion) {
    isCheckingAppVersion = false
    return
  }

  if (remoteVersion > lastVersion) {
    console.info('checkAnncVersion', remoteVersion, lastVersion)
    try {
      await fetchAnntList()
      lastVersion = remoteVersion
    }
    finally {
      isCheckingAppVersion = false
    }
  }
  else {
    isCheckingAppVersion = false
  }
}
