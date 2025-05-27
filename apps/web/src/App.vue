<script lang="tsx" setup>
import { KICKED_OUT_CHANNEL_NAME } from './constants/channel';
import { useDialog } from './hooks/useDialog';
import { $t } from './locales';
import { hidePageLoading, isMainWindow, showPageLoading } from './utils';
import { emitter, type MittEvents } from './utils/eventBus';
import GlobalComponent from '/@/components/business/global-component/index.vue'
import { useUserStore } from '/@/stores/user'
import LockScreen from '/@/components/lock-screen/index.vue'

const channel = new BroadcastChannel(KICKED_OUT_CHANNEL_NAME);
const [showModal] = useDialog()
const router = useRouter()

console.log('__WEB_VERSION__', __WEB_VERSION__)

const kickedOut = (params: MittEvents['kickedOut']) => {
  hidePageLoading()
  showModal({
    header: $t('登录提醒'),
    style: {
      width: '420px',
    },
    pt: {
      mask: {
        class: '!backdrop-blur',
      }
    },
    cancelText: '',
    closable: false,
    okText: $t('确认'),
    slots: {
      default: () => <div>
        <div>
          {$t('当前账号于 {time} 在 {deviceName} 设备上登录。', {
            time: params?.createTime,
            deviceName: decodeURIComponent(params?.deviceName || '')
          })}
        </div>
        <div class="mt-[20px]">{$t('若非本人操作，请及时修改密码。')}</div>
      </div>,
    },
    handleOk() {
      showPageLoading()
      useUserStore().clearUserInfo()
      router.push({ name: 'login' })
    },
  })
}

// 监听其他窗口/标签页发来的消息
channel.onmessage = (event) => {
  if (isMainWindow) {
    console.log('Received message:', event.data);
    kickedOut(event.data)
  } else {
    window.close()
  }
};

emitter.on('kickedOut', (params) => {
  if (isMainWindow) {
    channel.postMessage(params)
    kickedOut(params)
  } else {
    window.close()
  }
})

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
  color: var(--primitives-neutrals-0, #FFF);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}

.p-dialog-mask.p-overlay-mask {
  background: var(--colors-background-bg-mask);
  animation: dialog-mask-animation 0.15s forwards;
}

@keyframes dialog-mask-animation {
  0% {
    background: transparent;
  }

  100% {
    background: var(--colors-background-bg-mask);
  }
}
</style>
