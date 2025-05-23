<script setup lang="ts">
import { $t } from '/@/locales'

const props = defineProps<{
  isForceUpgrade: boolean
}>()

let timer: NodeJS.Timeout
const isDev = import.meta.hot
const visible = ref(false)

watchEffect(() => {
  visible.value = props.isForceUpgrade
})

/** 立即重启 */
async function upgradeNow() {
  window.electronAPI.send('app:quitAndInstall', {
    type: 'app',
  })
}

/** 稍后提醒我 */
function remindMeLater() {
  visible.value = false
  clearTimeout(timer)

  if (isDev) {
    console.log('开发环境下，稍后提醒我无效')
    return
  }

  if (props.isForceUpgrade) {
    timer = setTimeout(() => {
      visible.value = true
    }, 1000 * 60 * 1)
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :closable="false" class="w-[380px]">
    <div class="app-force-upgrade">
      <div class="detail-box">
        <div class="detail-body">
          <div class="relative">
            <SvgIcon class="app-logo" name="base/logo" />
            <SvgIcon class="upgrade-icon" name="base/rx_ic_updates" />
          </div>
          <div class="detail-content">
            <SvgIcon name="base/rx_ic_warn_fill" class="warn-icon" />
            <div>
              <div class="title">
                {{ $t('RoxyBrowser 更新通知') }}
              </div>
              <div class="content">
                {{ $t('RoxyBrowser 当前有重要的优化更新，请点击以下按钮重启客户端。') }}
              </div>
              <div class="tips">
                {{ $t('请注意，重启客户端会关闭你当前打开的窗口。') }}
              </div>
            </div>
          </div>
        </div>
        <RxButton class="w-full capitalize" @click="upgradeNow">
          {{ $t('立即重启') }}
        </RxButton>
        <rx-divider />
        <RxButton class="w-full" outlined @click="remindMeLater">
          {{ $t('稍后提醒我') }}
        </RxButton>
      </div>
    </div>
  </Dialog>
</template>

<style lang="scss" scoped>
.app-force-upgrade {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;

  .detail-box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2xl, 16px);
    align-self: stretch;

    .app-logo {
      width: 64px;
      height: 64px;
    }

    .upgrade-icon {
      width: 24px;
      height: 24px;
      position: absolute;
      bottom: 4px;
      right: -4px;
      color: #12a3fc;
      z-index: 10;
      background-color: white;
      border-radius: 50%;
    }

    .detail-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
    }

    .detail-content {
      display: flex;
      padding: var(--spacing-xl, 12px);
      align-items: flex-start;
      gap: 10px;
      align-self: stretch;
      border-radius: var(--radius-md, 6px);
      background: var(--primitives-yellow-100, #fff5e6);
      color: var(--primitives-neutrals-500, #0e1214);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;

      .warn-icon {
        color: #fc9d12;
      }

      .title {
        color: var(--primitives-neutrals-500, #0e1214);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
        margin-bottom: 12px;
      }

      .content,
      .tips {
        color: var(--colors-text-text-secondary, #b2b6b8);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 18px;
        /* 150% */
      }

      .tips {
        margin-top: 16px;
      }
    }
  }
}
</style>
