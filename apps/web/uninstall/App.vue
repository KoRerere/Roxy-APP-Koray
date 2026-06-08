<script setup lang="ts">
import { $t } from '/@/locales'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { API } from './api'
import { useElementBounding } from '@vueuse/core'
import type { UserGetUninstallReasonQuestionListListData } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { getUserAgentOs } from '/@/utils/basic'
import LiveChat from './live-chat.vue'
import { shuffle } from 'es-toolkit'

type UninstallStep = 'confirm' | 'feedback'

const step = ref<UninstallStep>('confirm')
const selectedReasons = ref<number[]>([])
/** 各选项对应的补充说明（选填），key 为 reason id */
const reasonDetailTexts = reactive<Record<number, string>>({})
const isSubmitting = ref(false)
const confirmPanelEl = useTemplateRef('confirmPanelEl')
const uninstallDialogEl = useTemplateRef('uninstallDialogEl')
const reasonListScrollEl = useTemplateRef('reasonListScrollEl')
const reasonItemRefs = new Map<number, HTMLElement>()

const confirmBox = useElementBounding(confirmPanelEl)
const feedbackBox = useElementBounding(uninstallDialogEl)

const toast = useToast()
const loading = ref(false)
/** 下次有效尺寸测量时是否需要居中（弹窗首次出现 / step 切换） */
const pendingCenter = ref(true)
const appVersion = ref()
const localNetwork = ref()
const isMac = computed(() => getUserAgentOs() === 'macOS')
const isLinux = computed(() => getUserAgentOs() === 'Linux')

// 卸载原因选项
const uninstallReasons = ref<UserGetUninstallReasonQuestionListListData['data']>()

const image = computed(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? '/images/rx_illustration_trash_dark.svg' : '/images/rx_illustration_trash_light.svg'
})

const imageBg = computed(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? `url('/images/uninstall_dark.svg')` : `url('/images/uninstall_light.svg')`
})

watch(
  [() => confirmBox.width.value, () => confirmBox.height.value, () => feedbackBox.width.value, () => feedbackBox.height.value],
  () => {
    if (pendingCenter.value) {
      return
    }
    void nextTick(() => {
      applyWindowResize()
    })
  },
  { flush: 'post' },
)

watch(step, () => {
  pendingCenter.value = true
})

onMounted(() => {
  void (async () => {
    pendingCenter.value = true
    await centerActivePanel()
    pendingCenter.value = false
    mixpanelTrack('before_uninstall_pop')
  })()
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

/** 等待 DOM 更新并完成布局绘制 */
async function waitForPanelLayout() {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  }))
}

function getActivePanelSize() {
  const el = step.value === 'confirm' ? confirmPanelEl.value : uninstallDialogEl.value
  if (!el) {
    return null
  }
  const { width, height } = el.getBoundingClientRect()
  if (width < 2 || height < 2) {
    return null
  }
  return { width: Math.round(width), height: Math.round(height) }
}

/** 仅调整窗口尺寸，不改变位置 */
function applyWindowResize() {
  const size = getActivePanelSize()
  if (!size) {
    return
  }
  globalThis.electronAPI.send('app:resizeWindow', size)
}

/** 在面板完全渲染后测量实际尺寸并居中 */
async function centerActivePanel() {
  await waitForPanelLayout()
  const size = getActivePanelSize()
  if (!size) {
    return
  }
  globalThis.electronAPI.send('app:resizeWindow', { ...size, center: true })
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
  loading.value = true
  step.value = 'feedback'
  await nextTick()
  await getUninstallReasonQuestionList()
}

async function getUninstallReasonQuestionList() {
  loading.value = true
  try {
    const { code, data, msg } = await API.base.getUninstallReasonQuestionListList()
    console.log('getUninstallReasonQuestionList', { code, data, msg })
    if (code === 0) {
      const [other, ...rest] = data.reverse()
      uninstallReasons.value = [...shuffle(rest), other]
    }
    else {
      toast.add({
        severity: 'error',
        summary: msg,
        life: 3000,
      })
    }
  }
  finally {
    loading.value = false
    // 等选项列表完全渲染、高度稳定后再居中
    if (step.value === 'feedback' && pendingCenter.value) {
      await centerActivePanel()
      pendingCenter.value = false
    }
  }
}

function setReasonItemRef(id: number, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) {
    reasonItemRefs.set(id, el)
  }
  else {
    reasonItemRefs.delete(id)
  }
}

function scrollReasonItemIntoView(id: number) {
  const container = reasonListScrollEl.value
  const item = reasonItemRefs.get(id)
  if (!container || !item) {
    return
  }

  const padding = 8
  const containerRect = container.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()

  if (itemRect.bottom > containerRect.bottom) {
    container.scrollTo({
      top: container.scrollTop + itemRect.bottom - containerRect.bottom + padding,
      behavior: 'smooth',
    })
  }
  else if (itemRect.top < containerRect.top) {
    container.scrollTo({
      top: Math.max(0, container.scrollTop - (containerRect.top - itemRect.top) - padding),
      behavior: 'smooth',
    })
  }
}

/**
 * 切换选择原因
 */
async function toggleReason(value: number) {
  const index = selectedReasons.value.findIndex(n => n === value)
  if (index > -1) {
    selectedReasons.value.splice(index, 1)
    delete reasonDetailTexts[value]
    return
  }

  selectedReasons.value.push(value)
  await nextTick()
  scrollReasonItemIntoView(value)
}

function buildOtherReasonTextList(): string[] {
  const reasons = uninstallReasons.value ?? []
  return selectedReasons.value
    .map((id) => {
      const text = (reasonDetailTexts[id] ?? '').trim()
      const code = reasons.find(reason => reason.id === id)?.code
      if (!text || !code) {
        return null
      }
      return `${code}:${text}`
    })
    .filter((item): item is string => item !== null)
}

/**
 * 提交反馈
 */
async function submitFeedback() {
  if (selectedReasons.value.length === 0) {
    return
  }

  const selectedReasonStr = buildOtherReasonTextList()

  isSubmitting.value = true
  try {
    // 发送反馈到服务器
    await API.base.uninstallReasonReportCreate({
      r_os: isMac.value ? 'mac' : (isLinux.value ? 'linux' : 'win'), // 平台类型
      language: $softConfig.language, // 语言
      userId: $softConfig.lastUserId, // 用户ID
      appVersion: appVersion.value, // app版本号
      selectedReasonIds: selectedReasons.value,
      otherReasonText: '',
      selectedReasons: selectedReasonStr,
    }).catch(() => {
      // 即使发送失败也继续退出
      console.error('Failed to submit uninstall feedback')
    })

    // 通知主进程可以退出
    await globalThis.electronAPI.send('app:uninstall-feedback-submitted', {
      reasons: [...selectedReasons.value],
      selectedReasons: selectedReasonStr,
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
  <div class="uninstall-root relative box-border h-screen w-screen bg-transparent">
    <div class="absolute left-0 top-0 z-100 h-10 w-92vw [-webkit-app-region:drag]" />

    <div v-if="step === 'confirm'" ref="confirmPanelEl" class="step1 box-border flex h-100 w-180 flex-col overflow-hidden rounded-2" :style="{ backgroundImage: imageBg }">
      <div class="shrink-0 pa-4 tt-primary font-[Archivo] text-4.5 font-700 leading-normal">
        {{ $t('卸载 Roxy浏览器') }}
      </div>
      <div class="min-h-0 flex flex-1 items-center gap-4 overflow-hidden px-4 pb-4">
        <div class="shrink-0 pa-10">
          <img class="block aspect-square w-35 object-cover" :src="image">
        </div>
        <div class="flex-1 flex min-w-0 flex-col overflow-hidden">
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

          <div class="mt-8 flex flex-wrap gap-3">
            <RxButton size="lg" @click="continueToUse">
              {{ $t('继续使用') }}
            </RxButton>
            <RxButton size="lg" severity="secondary" variant="outlined" @click="continueToFeedback">
              {{ $t('残忍卸载') }}
            </RxButton>
          </div>
        </div>
      </div>
    </div>

    <div v-else ref="uninstallDialogEl" class="step2 box-border flex w-full max-w-140 flex-col pa-4 pt-3  rounded-2">
      <div class="mb-3 flex-bc">
        <div class="tt-primary text-4 font-600 leading-normal">
          {{ $t('卸载原因') }}
        </div>
        <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="cancelUninstall" />
      </div>
      <div class="flex flex-col gap-4">
        <div class="contact flex items-center justify-between gap-3 rounded-1.5 px-4 py-3">
          <div class="flex flex-col gap-1">
            <div class="text-[var(--colors-text-text-brand)] text-3.5 font-700 leading-5.5">
              {{ $t('卸载前需要帮助吗？') }}
            </div>
            <div class="tt-secondary text-3 leading-4.5">
              {{ $t('我们的技术支持团队随时准备帮助您解决任何问题。') }}
            </div>
          </div>
          <RxButton class="shrink-0" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_headphone" :label="$t('联系客服')" @click="contactSupport" />
        </div>

        <RxDivider line-color="var(--colors-border-border-container)" />

        <div class="tt-primary text-3.5 font-700 leading-5.5">
          {{ $t('请告诉我们您卸载的原因（可多选）') }}
        </div>

        <div ref="reasonListScrollEl" class="reason-list-scroll overflow-y-auto overflow-x-hidden">
          <div class="flex flex-col gap-3 pr-1">
            <template v-if="loading">
              <Skeleton v-for="i in 6" :key="i" height="2rem" class="mb-2" />
            </template>
            <template v-else>
              <div v-for="reason in uninstallReasons" :key="reason.id" :ref="(el) => setReasonItemRef(reason.id, el)" class="flex flex-col gap-2">
                <button type="button" class="flex cursor-pointer items-center gap-2.5 pa-3 rounded-1.5 item" :class="{ active: selectedReasons.some(id => id === reason.id) }"
                        @click="toggleReason(reason.id)"
                >
                  <RxSvgIcon class="shrink-0" :name="selectedReasons.some(id => id === reason.id) ? 'base/rx_ic_check_fill' : 'base/rx_ic_uncheck'"
                             :color="selectedReasons.some(id => id === reason.id) ? 'var(--colors-background-bg-brand)' : 'var(--component-checker-inner-border)'"
                  />
                  <span class="tt-primary text-3.5 leading-5">{{ reason.title }}</span>
                </button>
                <textarea v-if="selectedReasons.some(id => id === reason.id)" v-model="reasonDetailTexts[reason.id]" :placeholder="$t('如果您愿意，可以详细说明一下原因，帮助我们改进...')" rows="3"
                          class="font-inherit w-full resize-y rounded-lg border border-[#c7d1d6] border-solid px-3 py-2 text-sm text-[#111213] shadow-[0px_1px_2px_rgba(16,24,40,0.05)] min-h-[72px] placeholder:text-[#575d60] focus:border-[#11a3fd] focus:outline-none"
                />
              </div>
            </template>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <RxButton severity="secondary" size="lg" variant="outlined" :disabled="isSubmitting || selectedReasons.length === 0" :label="$t('提交反馈')" @click="submitFeedback" />
          <button type="button" class="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-2" @click="uninstallDirectly">
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
  height: 400px;
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
  background-size: 100% auto;
}

.item {
  border: 1px solid var(--colors-border-divider);
  background: var(--colors-background-bg-page);

  &.active {
    border: 1px solid var(--colors-border-border-info);
    background: #def3ff;
  }
}

.uninstall-root {
  margin: 0;
  padding: 0;
  max-width: 100vw;
  max-height: 100vh;
}

.reason-list-scroll {
  max-height: min(360px, max(340px, calc(100vh - 340px)));
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--colors-border-border-container) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: var(--colors-border-border-container);
  }
}
</style>
