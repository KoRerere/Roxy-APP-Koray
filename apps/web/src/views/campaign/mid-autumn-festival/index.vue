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
/** 整机共用的静默截止时间，重启后仍生效，直到本地次日 0 点 */
const dismissTodayStorageKey = `${localStorageKey}:dismissToday`

const { isZh } = storeToRefs(useSimpleLocale())
const { seasonalActivity } = storeToRefs(useCampaignStore())
const [showModal] = useDialog()

const dialogInstance = ref<UseDialogInstance>()
/**
 * 本会话是否已关掉弹窗。
 * 用 sessionStorage：应用重启会清空会话，因此未点「今日不再提醒」时，每次启动都会再弹一次。
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

/** 本地次日 0 点。用本地年月日构造，避免日期库把参数当成 options */
function getTomorrowStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
}

/**
 * 读取静默截止时间。
 * 不用 useLocalStorage 的 number 序列化：它会把非数字内容 parseFloat 成 NaN 再写回，静默判断就永远不成立。
 */
function readDismissUntil() {
  const until = Number(localStorage.getItem(dismissTodayStorageKey))
  if (!Number.isFinite(until) || until <= 0) {
    localStorage.removeItem(dismissTodayStorageKey)
    return 0
  }
  return until
}

/** 本地次日 0 点之前不再自动弹出 */
function isDismissedToday() {
  return Date.now() < readDismissUntil()
}

/**
 * 记到本地次日 0 点，并清掉当天尚未触发的锚点。
 * 必须先停倒计时再删 session，否则到点回调仍会把弹窗打开。
 */
function silenceUntilTomorrow() {
  const until = getTomorrowStart()
  localStorage.setItem(dismissTodayStorageKey, String(until))
  activityCountdown.value?.stop()
  activityCountdown.value = undefined
  sessionStorage.removeItem(activityNextOpenStorageKey)
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

  // 启动、到点、过期补弹都走这里。静默期内一律不打开，force 也不能绕过
  if (isDismissedToday()) {
    scheduleReopen()
    return
  }

  if (!force && activityOpened.value) {
    scheduleReopen()
    return
  }

  openActivityModal()
}

/** 侧栏入口。静默只拦住自动弹出，手动点开不受影响 */
function openManually() {
  if (!seasonalActivity.value.midAutumnFestival || dialogInstance.value) {
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
        onDismissToday: () => {
          silenceUntilTomorrow()
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

  // 静默期内不走 10:00 / 15:00 / 21:30，并丢掉已过期的补弹时间，避免次日 0 点被当成立刻打开
  if (isDismissedToday()) {
    sessionStorage.removeItem(activityNextOpenStorageKey)
    const until = readDismissUntil()
    activityCountdown.value = enhanceCountdown(until, () => { }, {
      onEnd: () => {
        activityCountdown.value = undefined
        scheduleReopen()
      },
    })
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
  <div class="relative h-10 flex items-center justify-center rounded-1.5 select-none cursor-pointer overflow-hidden" @click="openManually">
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
