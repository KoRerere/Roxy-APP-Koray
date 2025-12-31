<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import MotionArrow from '/@/layout/components/header/resource-updater/motion-arrow.vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useSimpleLocale } from '/@/stores/locale'

const props = defineProps<{
  isForceUpgrade: boolean
  updateInfo?: ResourceUpdateMessage
}>()

let timer: NodeJS.Timeout
const isDev = import.meta.hot
const simpleLocale = useSimpleLocale()
const visible = ref(false)

const isActivityUpgrade = computed(() => {
  const { isActivity, activityInfo } = props.updateInfo?.newFeatureTips || {}
  return isActivity && activityInfo?.[simpleLocale.currentLocale!]?.imageList?.length > 0
})

watchEffect(() => {
  visible.value = props.isForceUpgrade
})

/** 立即重启 */
async function upgradeNow() {
  if (props.updateInfo?.type === 'app') {
    await window.electronAPI.send('app:quitAndInstall', {
      type: 'app',
    })
  }
  else if (props.updateInfo?.type === 'web') {
    await window.electronAPI.send('app:quitAndInstall', toRaw(props.updateInfo))
  }
}

console.debug('appUpdateInfo', props)

/** 稍后提醒我 */
function remindMeLater() {
  visible.value = false
  clearTimeout(timer)

  if (isDev) {
    console.log('In development environment, "remind me later" is invalid')
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
        <div class="detail-title">
          {{ isActivityUpgrade ? $t('活动更新提醒') : $t('有新的更新可用') }}
        </div>
        <div class="detail-body">
          <template v-if="isActivityUpgrade">
            <template v-for="item in updateInfo?.newFeatureTips?.activityInfo?.[simpleLocale.currentLocale!]?.imageList" :key="item.uid">
              <img :src="item.url" :alt="item.name" class="w-full object-cover rounded-lg">
            </template>
            <RxAlert class="whitespace-pre-wrap w-full" :title="$t('有新的可用更新')"
                     :content="`${$t('RoxyBrowser 新优惠上线！升级客户端版本即可享折扣。')}\n\n${updateInfo?.type === 'app' ? $t('请注意，重启客户端会关闭你当前打开的窗口。') : $t('本次更新无需重启客户端。')}`" type="warn"
                     :closable="false"
            />
          </template>
          <template v-else>
            <MotionArrow class="mx-auto" />
            <RxAlert class="whitespace-pre-wrap w-full" :title="$t('RoxyBrowser 更新通知')" :content="`${$t('RoxyBrowser 当前有重要的优化更新，请点击以下按钮重启客户端。')}\n\n${$t('请注意，重启客户端会关闭你当前打开的窗口。')}`" type="warn"
                     :closable="false"
            />
          </template>
        </div>
        <RxButton class="w-full capitalize" @click="upgradeNow">
          {{ updateInfo?.type === 'app' ? $t('立即重启') : $t('立即更新') }}
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

    .detail-title {
      color: var(--colors-text-text-primary);
      font-size: 16px;
      font-weight: 600;
      line-height: normal;
    }

    .detail-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
    }
  }
}
</style>
