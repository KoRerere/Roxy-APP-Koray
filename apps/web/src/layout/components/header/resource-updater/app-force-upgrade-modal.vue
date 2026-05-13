<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import MotionArrow from '/@/layout/components/header/resource-updater/motion-arrow.vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { isDev } from '/@/utils'

const props = defineProps<{
  isForceUpgrade: boolean
  updateInfo?: ResourceUpdateMessage
}>()

let timer: NodeJS.Timeout
const simpleLocale = useSimpleLocale()
const userStore = useUserStore()
const visible = ref(false)
const nextUpdateTimestamp = ref<number | undefined>(undefined)

const isActivityUpgrade = computed(() => {
  const { isActivity, activityInfo } = props.updateInfo?.newFeatureTips || {}
  return isActivity && activityInfo?.[simpleLocale.currentLocale!]?.imageList?.length > 0
})

watch(() => props.isForceUpgrade, (newVal) => {
  console.log('props.isForceUpgrade', newVal)
  globalThis.electronAPI.send('app:getSoftConfig').then((config) => {
    nextUpdateTimestamp.value = config.nextUpdateTimestamp
    // 如果是强制更新
    if (newVal) {
    // 如果上次点击了一小时后更新
      if (config.nextUpdateTimestamp) {
        // 如果上次点击了一小时后更新，则立即显示
        if (Date.now() > config.nextUpdateTimestamp) {
          visible.value = true
        }
        else {
          timer = setTimeout(() => {
            visible.value = true
          }, config.nextUpdateTimestamp - Date.now())
        }
      }
      else {
        visible.value = true
      }
    }
  })
})

/** 立即重启 */
async function upgradeNow() {
  if (props.updateInfo?.type === 'app') {
    await globalThis.electronAPI.send('app:quitAndInstall', {
      type: 'app',
    })
  }
  else if (props.updateInfo?.type === 'web') {
    await globalThis.electronAPI.send('app:quitAndInstall', toRaw(props.updateInfo))
  }
}

console.debug('appUpdateInfo', props)

/** 稍后提醒我 */
function remindMeLater() {
  visible.value = false
  clearTimeout(timer)

  // if (isDev) {
  //   console.log('In development environment, "remind me later" is invalid')
  //   return
  // }

  if (props.isForceUpgrade) {
    // 1 小时后更新
    const timestamp = Date.now() + 1000 * 60 * (isDev ? 2 : 60)
    globalThis.electronAPI.send('app:setNextUpdateTime', timestamp)
    nextUpdateTimestamp.value = timestamp
    timer = setTimeout(() => {
      visible.value = true
    }, timestamp - Date.now())
  }
  else {
    timer = setTimeout(() => {
      visible.value = true
    }, 1000 * 60 * 5)
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :close-on-escape="false" :closable="false" class="w-105" :pt="{ header: '!hidden', content: '!pa-6 !pt-4' }">
    <div class="flex flex-col gap-4">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ isActivityUpgrade ? $t('活动更新提醒') : $t('重要更新') }}
      </div>

      <template v-if="isActivityUpgrade">
        <template v-for="item in updateInfo?.newFeatureTips?.activityInfo?.[simpleLocale.currentLocale!]?.imageList" :key="item.uid">
          <img :src="item.url" :alt="item.name" class="w-full object-cover rounded-lg">
        </template>
        <RxAlert class="whitespace-pre-wrap w-full" :title="$t('有新的可用更新')"
                 :content="`${$t('Roxy浏览器新活动上线！升级客户端版本即可参与活动。')}\n\n${updateInfo?.type === 'app' ? $t('请注意，重启客户端会关闭你当前打开的窗口。') : $t('本次更新无需重启客户端。')}`" type="warn" :closable="false"
        />
      </template>
      <template v-else>
        <div class="flex flex-col gap-2">
          <MotionArrow class="mx-auto pt-2 pb-1.5" />
          <div class=" tt-primary font-[JetBrains_Mono] font-700 text-center text-4 leading-5">
            v{{ userStore.appVersion }} -> v{{ updateInfo?.version }}
          </div>
        </div>

        <div class=" tt-secondary text-3.5 leading-5">
          {{ $t('Roxy浏览器新版本已就绪！更新将为您带来性能优化与稳定性提升，需要您完成更新以继续使用。') }}
        </div>

        <RxAlert class="whitespace-pre-wrap w-full" :content="$t('更新需要重启应用，重启后将为您恢复已打开的窗口。')" type="warn"
                 :closable="false"
        />
      </template>

      <div class="-mt-1 flex flex-col gap-2 self-stretch">
        <RxButton class="capitalize" size="lg" :label="updateInfo?.type === 'app' ? $t('立即重启') : $t('立即更新')" @click="upgradeNow" />
        <RxButton v-if="!nextUpdateTimestamp" class="!tt-tertiary" severity="secondary" variant="text" size="lg"
                  :label="isForceUpgrade ? $t('1 小时后更新') : $t('稍后提醒我')" @click="remindMeLater"
        />
      </div>
    </div>
  </Dialog>
</template>

<style lang="scss" scoped></style>
