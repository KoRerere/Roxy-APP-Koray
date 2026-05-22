<script setup lang="ts">
import { $t } from '/@/locales'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { API } from './api'
import { useElementBounding } from '@vueuse/core'
import type { UserGetUninstallReasonQuestionListListData } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { getUserAgentOs } from '/@/utils/basic'
import LiveChat from './live-chat.vue'
import { url } from 'node:inspector'

type UninstallStep = 'confirm' | 'feedback'

const step = ref<UninstallStep>('confirm')
const selectedReasons = ref<number[]>([])
const feedbackText = ref('')
const isSubmitting = ref(false)
const confirmPanelEl = useTemplateRef('confirmPanelEl')
const uninstallDialogEl = useTemplateRef('uninstallDialogEl')

const confirmBox = useElementBounding(confirmPanelEl)
const feedbackBox = useElementBounding(uninstallDialogEl)

const toast = useToast()
const loading = ref(false)
const appVersion = ref()
const localNetwork = ref()
const isMac = computed(() => getUserAgentOs() === 'macOS')
const isLinux = computed(() => getUserAgentOs() === 'Linux')

// 卸载原因选项
const uninstallReasons = ref<UserGetUninstallReasonQuestionListListData['data']>()
const otherReasonId = computed(() => {
  return uninstallReasons.value?.find(reason => reason.code === 'other')?.id
})

const image = computed(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? '/images/rx_illustration_trash_dark.svg' : '/images/rx_illustration_trash_light.svg'
})

const imageBg = computed(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? `url('/images/uninstall_dark.svg')` : `url('/images/uninstall_light.svg')`
})

watch(
  [step, () => confirmBox.width.value, () => confirmBox.height.value, () => feedbackBox.width.value, () => feedbackBox.height.value],
  () => {
    void nextTick(() => {
      resizeWindowToActivePanel()
    })
  },
  { flush: 'post' },
)

onMounted(() => {
  nextTick(() => {
    resizeWindowToActivePanel()
    mixpanelTrack('before_uninstall_pop')
  })
})

async function mixpanelTrack(event_name: string, data?: Record<string, any>) {
  appVersion.value ??= await globalThis.electronAPI.send('app:getAppVersion')
  localNetwork.value ??= await globalThis.electronAPI.send('proxy:detectNetwork', 'local')

  mixpanel.track(event_name, {
    event_name,
    time: Date.now(),
    screen_resolution: `${screen.width}x${screen.height}`,
    country_code: localNetwork.value.country_code,
    $city: localNetwork.value.city,
    $region: localNetwork.value.region,
    $country_code: localNetwork.value.country_code,
    $timezone: localNetwork.value.timezone,
    $appVersion: appVersion.value,
    $user_id: $softConfig.lastUserId,
    $app_language: $softConfig.language,
    ...data,
  })
}

function resizeWindowToActivePanel() {
  const w = step.value === 'confirm' ? confirmBox.width.value : feedbackBox.width.value
  const h = step.value === 'confirm' ? confirmBox.height.value : feedbackBox.height.value
  if (w < 2 || h < 2) {
    return
  }
  globalThis.electronAPI.send('app:resizeWindow', {
    width: Math.ceil(w),
    height: Math.ceil(h),
  })
}

/**
 * 继续使用
 */
function continueToUse() {
  mixpanelTrack('before_uninstall_continue_using')
  cancelUninstall()
}

/**
 * 进入反馈收集步骤
 */
async function continueToFeedback() {
  step.value = 'feedback'
  await nextTick()
  resizeWindowToActivePanel()
  getUninstallReasonQuestionList()
}

async function getUninstallReasonQuestionList() {
  loading.value = true
  const { code, data, msg } = await API.base.getUninstallReasonQuestionListList().finally(() => {
    loading.value = false
  })
  console.log('getUninstallReasonQuestionList', { code, data, msg })
  if (code === 0) {
    uninstallReasons.value = data
  }
  else {
    toast.add({
      severity: 'error',
      summary: msg,
      life: 3000,
    })
  }
}

/**
 * 切换选择原因
 */
function toggleReason(value: number) {
  const index = selectedReasons.value.findIndex(n => n === value)
  if (index > -1) {
    selectedReasons.value.splice(index, 1)
  }
  else {
    selectedReasons.value.push(value)
  }
}

/**
 * 提交反馈
 */
async function submitFeedback() {
  if (selectedReasons.value.length === 0 && !feedbackText.value.trim()) {
    return
  }

  isSubmitting.value = true
  try {
    // 发送反馈到服务器
    await API.base.uninstallReasonReportCreate({
      r_os: isMac.value ? 'mac' : (isLinux.value ? 'linux' : 'win'), // 平台类型
      language: $softConfig.language, // 语言
      userId: $softConfig.lastUserId, // 用户ID
      appVersion: appVersion.value, // app版本号
      selectedReasonIds: selectedReasons.value,
      otherReasonText: feedbackText.value.trim(),
    }).catch(() => {
      // 即使发送失败也继续退出
      console.error('Failed to submit uninstall feedback')
    })

    // 通知主进程可以退出
    await globalThis.electronAPI.send('app:uninstall-feedback-submitted', {
      reasons: [...selectedReasons.value],
      feedback: feedbackText.value.trim(),
    })
  }
  catch (error) {
    console.error('Submit feedback error:', error)
  }
  finally {
    isSubmitting.value = false
  }
}

/**
 * 直接卸载
 */
async function uninstallDirectly() {
  mixpanelTrack('before_uninstall_no_feedback')
  await globalThis.electronAPI.send('app:uninstall-directly')
}

/**
 * 取消卸载（仅在卸载模式下显示）
 */
async function cancelUninstall() {
  await globalThis.electronAPI.send('app:uninstall-cancelled')
}

/**
 * 联系客服
 */
function contactSupport() {
  mixpanelTrack('before_uninstall_contact', {
    before_uninstall_contac_entrance: step.value === 'confirm' ? 'Uninstall Pop' : 'Reason Bug',
  })
  // 这里可以打开客服链接或窗口
  showLiveChat()
}
</script>

<template>
  <div class="relative flex h-screen w-screen items-center justify-center bg-transparent">
    <div class="absolute left-0 right-0 top-0 z-[1000] h-[30px] [-webkit-app-region:drag]" />

    <div v-if="step === 'confirm'" ref="confirmPanelEl" class="flex flex-col max-w-full w-180 h-100 rounded-2 step1" :style="{ backgroundImage: imageBg }">
      <div class="pa-6 tt-primary font-[Archivo] text-4.5 font-700 leading-normal">
        {{ $t('卸载 Roxy浏览器') }}
      </div>
      <div class="flex-1 flex items-center px-6 gap-5 overflow-hidden -mt-10">
        <div class="pa-10 ">
          <img class="block w-35 aspect-square object-cover" :src="image">
        </div>
        <div class="flex flex-col">
          <div class="tt-primary font-[Archivo] text-6 font-700 leading-8">
            {{ $t('真的要说再见嘛？') }}
          </div>
          <i18n-t tag="div" class="mt-2 tt-primary text-3.5 leading-5" scope="global" :keypath="$t('如需协助，{link}，马上为您解决！ ', { link: '{link}' })">
            <template #link>
              <span class="cursor-pointer link" @click="contactSupport">
                {{ $t('联系客服') }}
              </span>
            </template>
          </i18n-t>

          <div class="mt-5 flex gap-4 justify-start">
            <RxButton @click="continueToUse">
              {{ $t('继续使用') }}
            </RxButton>
            <RxButton severity="secondary" variant="outlined" @click="continueToFeedback">
              {{ $t('残忍卸载') }}
            </RxButton>
          </div>
        </div>
      </div>
    </div>

    <div v-else ref="uninstallDialogEl" class="w-140 h-auto flex flex-col pa-6 pt-4 rounded-2 step2">
      <div class="mb-4 flex-bc">
        <div class="tt-primary text-4 font-600 leading-normal">
          {{ $t('卸载原因') }}
        </div>
        <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="cancelUninstall" />
      </div>
      <div class="flex flex-col gap-5">
        <div class="flex items-center justify-between gap-5 py-4 px-5 rounded-1.5 contact">
          <div class="flex flex-col gap-1">
            <div class="text-[var(--colors-text-text-brand)] text-4 font-700 leading-6">
              {{ $t('卸载前需要帮助吗？') }}
            </div>
            <div class=" tt-secondary text-3.25 leading-4.5">
              {{ $t('我们的技术支持团队随时准备帮助您解决任何问题。') }}
            </div>
          </div>
          <RxButton class="shrink-0" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_headphone" :label="$t('联系客服')" @click="contactSupport" />
        </div>

        <RxDivider line-color="var(--colors-border-border-container)" />

        <div class="tt-primary text-4 font-700 leading-6">
          {{ $t('请告诉我们您卸载的原因（可多选）') }}
        </div>

        <div class="flex flex-1 flex-col gap-3">
          <template v-if="loading">
            <Skeleton v-for="i in 6" :key="i" height="2rem" class="mb-2" />
          </template>
          <template v-else>
            <button v-for="reason in uninstallReasons" :key="reason.id" type="button" class="flex cursor-pointer items-center gap-2.5 pa-3 rounded-1.5 item"
                    :class="{ active: selectedReasons.some(id => id === reason.id) }" @click="toggleReason(reason.id)"
            >
              <RxSvgIcon class="shrink-0" :name="selectedReasons.some(id => id === reason.id) ? 'base/rx_ic_check_fill' : 'base/rx_ic_uncheck'"
                         :color="selectedReasons.some(id => id === reason.id) ? 'var(--colors-background-bg-brand)' : 'var(--component-checker-inner-border)'"
              />
              <span class="tt-primary text-3.5 leading-5">{{ reason.title }}</span>
            </button>
          </template>
        </div>

        <div v-if="selectedReasons.some(id => id === otherReasonId)" class="-mt-2">
          <textarea v-model="feedbackText" :placeholder="$t('如果您愿意，可以详细说明一下原因，帮助我们改进...')" rows="5"
                    class="font-inherit w-full resize-y rounded-lg border border-[#c7d1d6] border-solid p-3 text-sm text-[#111213] shadow-[0px_1px_2px_rgba(16,24,40,0.05)] min-h-[149px] placeholder:text-[#575d60] focus:border-[#11a3fd] focus:outline-none"
          />
        </div>

        <div class="flex flex-col gap-3">
          <RxButton severity="secondary" size="lg" variant="outlined" :disabled="isSubmitting || (selectedReasons.length === 0 && !feedbackText.trim())" :label="$t('提交反馈')" @click="submitFeedback" />
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-2"
            @click="uninstallDirectly"
          >
            <span class="min-w-0 flex-1 text-right text-3.25 font-500 leading-5 tt-inactive">
              {{ $t('直接卸载，无需反馈') }}
            </span>
            <RxSvgIcon class="shrink-0" name="base/rx_ic_arrow_right_2" size="16" color="var(--colors-text-text-inactive)" />
          </button>
        </div>
      </div>
    </div>
  </div>
  <Toast group="tr" />
  <LiveChat />
</template>

<style>
html,
body {
  background-color: transparent !important;
  margin: 0;
}
</style>

<style lang="scss" scoped>
.step1 {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-base);
  box-shadow:
    0 1px 1px 0 rgba(0, 0, 0, 0.04),
    0 2px 8px 0 rgba(0, 0, 0, 0.04),
    0 3px 17px 0 rgba(0, 0, 0, 0.04),
    0 4px 30px 0 rgba(0, 0, 0, 0.12);

  background-color: var(--colors-background-bg-page);
  background-repeat: no-repeat;
}

.link {
  color: var(--colors-text-text-link);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: 25%;
  text-underline-position: from-font;
}

.step2 {
  border: 1px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-page);
  box-shadow:
    0 1px 1px 0 rgba(0, 0, 0, 0.04),
    0 2px 8px 0 rgba(0, 0, 0, 0.04),
    0 3px 17px 0 rgba(0, 0, 0, 0.04),
    0 4px 30px 0 rgba(0, 0, 0, 0.12);
}

.contact {
  background: url('/images/uninstall/cards-light.svg') no-repeat center center;
}

.item {
  border: 1px solid var(--colors-border-divider);
  background: var(--colors-background-bg-page);

  &.active {
    border: 1px solid var(--colors-border-border-info);
    background: #def3ff;
  }
}
</style>
