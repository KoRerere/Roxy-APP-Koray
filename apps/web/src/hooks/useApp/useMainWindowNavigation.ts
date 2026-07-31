import { MAIN_WINDOW_NAME, MAIN_WINDOW_NAVIGATION_CHANNEL_NAME } from '/@/constants/channel'
import { isMainWindow } from '/@/utils/common'

/**
 * 主窗口跨标签页导航：设置窗口名并监听 BroadcastChannel 路由跳转。
 */
export function useMainWindowNavigation() {
  const router = useRouter()
  const mainWindowNavigationChannel = new BroadcastChannel(MAIN_WINDOW_NAVIGATION_CHANNEL_NAME)

  if (isMainWindow) {
    window.name = MAIN_WINDOW_NAME
  }

  mainWindowNavigationChannel.onmessage = (event) => {
    if (!isMainWindow)
      return

    const target = event.data
    if (target) {
      router.push(target)
    }
    window.focus()
  }
}
