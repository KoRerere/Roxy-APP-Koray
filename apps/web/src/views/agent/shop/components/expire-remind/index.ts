import { h } from 'vue'
import ExpireRemindDialog from './expire-remind-dialog.vue'
import { useDialog } from '/@/hooks/useDialog'

/** 代理 IP 页和窗口管理共用一个实例，避免登录落地和页面进入叠两层 */
const DIALOG_KEY = 'proxy-expire-remind'

export interface ProxyExpireRemindHandlers {
  /** 列表返回前，标题里的即将过期数量 */
  ipCount?: number
  /** 这些临期 IP 是否至少绑了一个窗口。没有绑定时标题只报 IP 数量，并用警告色 */
  hasBoundProfile?: boolean
  /** 关闭、遮罩、暂不处理 */
  onUserDismiss?: () => void
  onDismissToday?: (checked: boolean) => void
}

let opened = false

/** 打开代理 IP 到期提醒。标题用风险文案，表格用即将过期样式 */
export function useProxyExpireRemind() {
  const [showModal] = useDialog()

  function open(handlers?: ProxyExpireRemindHandlers) {
    if (opened) {
      return
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      dismissableMask: true,
      uniqueKey: DIALOG_KEY,
      pt: {
        content: '!p-0',
      },
      /**
       * 关闭按钮、遮罩和暂不处理都走 hideModal，在这里统一记冷却
       */
      beforeClose: () => {
        handlers?.onUserDismiss?.()
        opened = false
      },
      slots: {
        container: ({ hideModal }) => h(ExpireRemindDialog, {
          ipCount: handlers?.ipCount,
          hasBoundProfile: handlers?.hasBoundProfile,
          onClose: () => {
            void hideModal()
          },
          onNotNow: () => {
            void hideModal()
          },
          onDismissToday: (checked: boolean) => {
            handlers?.onDismissToday?.(checked)
          },
        }),
      },
    })

    opened = true
  }

  return {
    open,
  }
}
