import { KICKED_OUT_CHANNEL_NAME } from '/@/constants/channel'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils/common'
import { useEmitterEvent } from '/@/utils/eventBus'
import type { MittEvents } from '/@/utils/eventBus'
import { markSessionLost } from '/@/utils/sessionLost'

const channel = new BroadcastChannel(KICKED_OUT_CHANNEL_NAME)

/**
 * 挤号 / 掉登录态处理：弹窗提醒、BroadcastChannel 同步多窗口、关闭所有浏览器。
 */
export function useKickedOut() {
  const router = useRouter()
  const [showModal] = useDialog()

  function handleKickedOut(params: MittEvents['kickedOut']) {
    console.log('handleKickedOut', params)
    hidePageLoading()
    showModal({
      header: $t('登录提醒'),
      style: {
        width: '420px',
      },
      pt: {
        mask: {
          class: '!backdrop-blur',
        },
      },
      cancelText: '',
      closable: false,
      okText: $t('确认'),
      noAutoClose: true,
      slots: {
        default: () => (
          <div>
            <div>
              {$t('当前账号于 {time} 在 {deviceName} 设备上登录。', {
                time: params?.createTime,
                deviceName: decodeURIComponent(params?.deviceName || ''),
              })}
            </div>
            <div class="mt-[20px]">{$t('若非本人操作，请及时修改密码。')}</div>
          </div>
        ),
      },
      handleOk() {
        showPageLoading()
        useUserStore().clearUserInfo()
        router.push({ name: 'login' })
      },
    })
    globalThis.electronAPI.send('browser:closeAll')
  }

  /** 监听其他窗口/标签页发来的消息 */
  channel.onmessage = (event) => {
    if (isMainWindow) {
      console.log('Received message:', event.data)
      handleKickedOut(event.data)
    }
    else {
      window.close()
    }
  }

  function onKickedOut(params: MittEvents['kickedOut']) {
    if (isMainWindow) {
      // 主进程 user:kicked-out 与接口 405 均算掉登录态，仅记录首次时间
      markSessionLost()
      channel.postMessage(params)
      handleKickedOut(params)
    }
    else {
      window.close()
    }
  }

  useEmitterEvent('kickedOut', onKickedOut)
  globalThis.electronAPI.on('user:kicked-out', onKickedOut)
}
