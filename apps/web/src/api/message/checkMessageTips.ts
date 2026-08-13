import type { AxiosResponse } from 'axios'
import { API } from '/@/api'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { emitter } from '/@/utils/eventBus'

/** 上一次已处理的 r-user-message（同值去重） */
let lastUserMessage = ''
/** 去重所绑定的 workspace，切换后重置以免跨空间误跳过 */
let lastWorkspaceId: number | string | undefined
let isGettingMessageTips = false

/**
 * 响应头 r-user-message 变化时拉取定向消息弹窗。
 * userGetMessageTipsCreate 依赖拦截器写入的 workspaceId，须等正式进空间后再请求。
 */
export async function checkMessageTips(response: AxiosResponse<any, any>) {
  const userMessage = response.headers['r-user-message']

  if (!userMessage || isGettingMessageTips) {
    return
  }

  // silent 仅准备 header；正式进空间后再拉，与公告等副作用一致
  const workspaceStore = useWorkspaceStore()
  const workspaceId = workspaceStore.currentWorkspace?.id
  if (!workspaceId || workspaceStore.workspaceEntrySilent) {
    return
  }

  if (workspaceId !== lastWorkspaceId) {
    lastUserMessage = ''
    lastWorkspaceId = workspaceId
  }

  if (String(userMessage) === String(lastUserMessage)) {
    return
  }

  isGettingMessageTips = true
  try {
    const result = await API.base.userGetMessageTipsCreate({})
    if (result.code !== 0) {
      return
    }

    lastUserMessage = String(userMessage)

    const locale = useSimpleLocale().currentLocale
    const localTips = result.data?.messageTips?.[locale as 'zh-CN' | 'en' | 'ru']
    const tips = localTips?.[0]?.content
      ? localTips.filter((item: { content?: string }) => item.content?.length)
      : []

    if (tips.length) {
      emitter.emit('showMessageTipsDialog', tips)
    }
  }
  finally {
    isGettingMessageTips = false
  }
}
