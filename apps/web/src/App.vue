<script lang="tsx" setup>
import { useDialog } from './hooks/useDialog';
import { $t } from './locales';
import { emitter } from './utils/eventBus';
import GlobalComponent from '/@/components/business/global-component/index.vue'

const [dialog] = useDialog()
const router = useRouter()


console.log('__WEB_VERSION__', __WEB_VERSION__)

emitter.on('kickedOut', (params) => {
  dialog.showModal({
    header: $t('登录提醒'),
    style: {
      width: '420px',
    },
    cancelText: '',
    closable: false,
    okText: $t('确认'),
    slots: {
      default: () => <div>
        <div>{$t('当前账号于 {time} 在 {deviceName} 设备上登录。', { time: params?.createTime, deviceName: params?.deviceName })}</div>
        <div class="mt-[20px]">{$t('若非本人操作，请及时修改密码。')}</div>
      </div>,
    },
    handleOk() {
      router.push({ name: 'login' })
    },
  })
})

</script>

<template>
  <RouterView />
  <GlobalComponent />
</template>

<style lang="scss">
.p-tooltip-arrow {
  display: none;
}

.p-tooltip-text {
  color: var(--Color-neutrals-0, #FFF);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
