<script setup lang="ts">
import FirstGift from '/@/views/tutorial/components/welcome-modal/first-gift.vue'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { emitter } from '/@/utils/eventBus'
import type { FirstGiftType } from '/@/enums/pay'
import { genDefaultProfileByCount } from '/@/views/browser/create/form-inputs'
import { API } from '/@/api'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const themeStore = useThemeStore()
const { mixpanelTrack, userInfo, updateUserConfig } = useUserStore()

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/information_bg.svg")' : 'url("/images/information_bg_dark.svg")'
})

onMounted(() => {
  mixpanelTrack('welcome_page_view')
})

function onClose() {
  emit('close')
}

async function receiveSuccess(type?: FirstGiftType) {
  if (type) {
    emitter.emit('firstRegisterGuide')
  }
  else if (!globalThis.isElectron && userInfo.onboardingTaskStatus?.firstWebRegisterGuideStatus === false) {
    // 新用户 web 端自动创建一个窗口
    const windowIds = await genDefaultProfileByCount(1)
    if (windowIds?.length) {
      emitter.emit('refreshProfileList')
      API.base.userUpdateOnboardingTaskStatusCreate({ firstWebRegisterGuideStatus: true, firstRegisterGuideStatus: true })
      // 激活云端浏览器
      // await API.window.userActivateCloudBrowserCreate({ windowId: windowIds[0] }).then(() => {
      //   updateUserConfig()
      // })
    }
    emitter.emit('firstRegisterGuide')
  }
  onClose()
}
</script>

<template>
  <div class="w-240 py-6 welcome">
    <div class="flex items-center justify-between px-6">
      <div class="flex items-center gap-1.5">
        <SvgIcon name="base/logo" size="36" />
        <span class="welcome-logo">{{ $t('Roxy浏览器') }}</span>
      </div>
      <div class="welcome-text">
        {{ $t('欢迎加入') }}
      </div>
    </div>
    <FirstGift :next="receiveSuccess" />
  </div>
</template>

<style lang="scss" scoped>
.welcome {
  background-image: v-bind(bgSrc);
  background-repeat: no-repeat;
  background-position: center 0;

  &-logo {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 18px;
    font-weight: 700;
    line-height: normal;
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }
}
</style>
