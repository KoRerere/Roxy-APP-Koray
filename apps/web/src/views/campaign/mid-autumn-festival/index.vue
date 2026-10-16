<script setup lang="ts">
import type { UseDialogInstance } from '/@/hooks/useDialog'
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useCampaignStore } from '/@/stores/campaign'
import { useSimpleLocale } from '/@/stores/locale'
import { enhanceCountdown, getImage, safeParseJSON } from '/@/utils/basic'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

/** 每天按用户电脑本地时间弹出的时刻 */
const POPUP_MARKS = [
  { hour: 10, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 21, minute: 30 },
] as const

const activityNextOpenStorageKey = `${localStorageKey}:nextOpen`

const { isZh } = storeToRefs(useSimpleLocale())
const { seasonalActivity } = storeToRefs(useCampaignStore())
const [showModal] = useDialog()

const dialogInstance = ref<UseDialogInstance>()
/**
 * 本会话是否已关掉弹窗。
 * 用 sessionStorage：应用重启会清空会话，因此每次启动都会再弹一次。
 */
const activityOpened = ref(safeParseJSON(sessionStorage.getItem(localStorageKey)))
const activityCountdown = ref<ReturnType<typeof enhanceCountdown>>()

const imgSrc = computed(() => isZh.value ? getImage('campaing/mid-autumn-festival/banner_icon_zh.png') : getImage('campaing/mid-autumn-festival/banner_icon_en.png'))

onMounted(() => {
  requestModal()
})

onBeforeUnmount(() => {
  activityCountdown.value?.stop()
  activityCountdown.value = undefined
  void dialogInstance.value?.hideModal()
})

/** 记录本会话已关闭，避免同一次启动里重复立刻弹出 */
function markDismissed() {
  activityOpened.value = true
  sessionStorage.setItem(localStorageKey, JSON.stringify(true))
}

/** 关闭后才预约下一个时间点；未关闭时不会叠出新弹窗 */
function onDismiss() {
  dialogInstance.value = undefined
  markDismissed()
  scheduleReopen()
}

/**
 * 打开活动弹窗。
 * 已有实例时直接返回，保证同一时刻只有一个。
 */
function requestModal(force = false) {
  if (!seasonalActivity.value.midAutumnFestival || dialogInstance.value) {
    return
  }

  if (!force && activityOpened.value) {
    scheduleReopen()
    return
  }

  openActivityModal()
}

/** 展示中秋活动弹窗，关闭完成后才进入下一次预约 */
function openActivityModal() {
  dialogInstance.value = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1100',
    },
    handleCancel: onDismiss,
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          void hideModal().then(closed => closed && onDismiss())
        },
      }),
    },
  })
}

/** 预约严格晚于当前时刻的下一个本地时间弹出点 */
function scheduleReopen() {
  if (activityCountdown.value) {
    return
  }

  const stored = Number(sessionStorage.getItem(activityNextOpenStorageKey))
  const hasStored = Number.isFinite(stored) && stored > 0

  if (hasStored && stored <= Date.now()) {
    sessionStorage.removeItem(activityNextOpenStorageKey)
    requestModal(true)
    return
  }

  const nextOpenAt = hasStored ? stored : getNextPopupAt()
  if (!hasStored) {
    sessionStorage.setItem(activityNextOpenStorageKey, String(nextOpenAt))
  }

  activityCountdown.value = enhanceCountdown(nextOpenAt, () => { }, {
    onEnd: () => {
      activityCountdown.value = undefined
      sessionStorage.removeItem(activityNextOpenStorageKey)
      requestModal(true)
    },
  })
}

/**
 * 取下一个弹出时刻。
 * 用本机本地时区；当天锚点已过则顺延到次日 10:00，正好卡在锚点上也不立刻重开。
 */
function getNextPopupAt(now = Date.now()) {
  const localNow = new Date(now)
  const year = localNow.getFullYear()
  const month = localNow.getMonth()
  const date = localNow.getDate()

  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    for (const mark of POPUP_MARKS) {
      const at = new Date(year, month, date + dayOffset, mark.hour, mark.minute).getTime()
      if (at > now) {
        return at
      }
    }
  }

  return new Date(year, month, date + 1, POPUP_MARKS[0].hour, POPUP_MARKS[0].minute).getTime()
}
</script>

<template>
  <div class="relative h-10 flex items-center justify-center rounded-1.5 select-none cursor-pointer overflow-hidden" @click="requestModal(true)">
    <img v-if="collapsed" class="block w-full aspect-square" :src="imgSrc">
    <template v-else>
      <div class="relative w-full z-1 pl-3 pr-2.5 flex items-center justify-between">
        <span class="color-white text-3.25 font-700 leading-4.5">{{ $t('金秋狂欢季 · 豪礼享不停') }}</span>
        <SvgIcon name="base/rx_ic_arrow_right_2" color="#ffffff" />
      </div>
      <img draggable="false" class="absolute inset-0 w-full h-full" :src="getImage('campaing/mid-autumn-festival/banner_bg_mini.png')">
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
