<script lang="tsx" setup>
import { KICKED_OUT_CHANNEL_NAME } from './constants/channel'
import { useDialog } from './hooks/useDialog'
import { $t } from './locales'
import { hidePageLoading, isMainWindow, showPageLoading } from './utils'
import { emitter } from './utils/eventBus'
import type { MittEvents } from './utils/eventBus'
import GlobalComponent from '/@/components/business/global-component/index.vue'
import { useUserStore } from '/@/stores/user'
import LockScreen from '/@/components/lock-screen/index.vue'

const channel = new BroadcastChannel(KICKED_OUT_CHANNEL_NAME)
const router = useRouter()
const [showModal] = useDialog()

console.log('__WEB_VERSION__', __WEB_VERSION__)

function handleKickedOut(params: MittEvents['kickedOut']) {
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
  electronAPI.send('browser:closeAll')
}

/**
 * 监听其他窗口/标签页发来的消息
 */
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
    channel.postMessage(params)
    handleKickedOut(params)
  }
  else {
    window.close()
  }
}

emitter.on('kickedOut', onKickedOut)
electronAPI.on('user:kicked-out', onKickedOut)
</script>

<template>
  <LockScreen>
    <RouterView />
  </LockScreen>
  <GlobalComponent />
</template>

<style lang="scss">
.p-tooltip-arrow {
  display: none;
}

.p-tooltip-text {
  color: var(--primitives-neutrals-0, #fff);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}

.global_driver_class {
  min-width: 220px;
  max-width: 220px;
  padding: 12px;
  border-radius: 6px;
  background: var(--pattern-tour-tips-bg);
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07);

  .driver-popover-description,
  .driver-popover-progress-text {
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  .driver-popover-footer {
    margin-top: 6px;
  }

  .driver-popover-arrow-side-left.driver-popover-arrow {
    border-left-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-right.driver-popover-arrow {
    border-right-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-top.driver-popover-arrow {
    border-top-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-bottom.driver-popover-arrow {
    border-bottom-color: var(--pattern-tour-tips-bg);
  }

  button {
    min-width: 60px;
    padding: 4px 8px;
    text-align: center;
    border-radius: 4px;
    background: var(--colors-alpha-alpha-white-20);
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    border: none;
    text-shadow: none;

    &:focus,
    &:hover {
      background: var(--colors-alpha-alpha-white-20);
    }
  }
}
</style>
