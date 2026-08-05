<script setup lang="ts">
import type { UseDialogInstance } from '/@/hooks/useDialog'
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useCampaignStore } from '/@/stores/campaign'
import { useUserStore } from '/@/stores/user'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { emitter } from '/@/utils/eventBus'
import { OrderType } from '/@/enums/pay'
import { enhanceCountdown, getImage, safeParseJSON } from '/@/utils/basic'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const REOPEN_INTERVAL_MS = 1000 * 60 * 60 * 24
/** 下次自动弹出时间戳，与 opened 标记分开存，避免重挂载重复排程 */
const nextOpenStorageKey = `${localStorageKey}:nextOpen`

const router = useRouter()
const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const [showModal] = useDialog()

const countdown = ref<ReturnType<typeof enhanceCountdown>>()
const dialogInstance = ref<UseDialogInstance>()
const opened = ref(safeParseJSON(sessionStorage.getItem(localStorageKey)))

const imageSrc = computed(() => {
  return getImage(`campaing/june-eighteen/mini.png`)
})

onMounted(() => {
  openModal()
})

onBeforeUnmount(() => {
  // 组件销毁时停掉内存定时器，避免与下次挂载的排程叠出双弹窗
  countdown.value?.stop()
  countdown.value = undefined
})

function markDismissed() {
  opened.value = true
  sessionStorage.setItem(localStorageKey, JSON.stringify(true))
}

/** 关闭弹窗后的统一收尾：标记已读 + 排 24h 再弹（幂等） */
function onDismiss() {
  dialogInstance.value = undefined
  markDismissed()
  scheduleReopen()
}

function openModal(force = false) {
  if (!seasonalActivity.value.juneEighteen)
    return

  // 已有实例时不再 showModal，防止遮罩叠两层
  if (dialogInstance.value)
    return

  if (!force && opened.value) {
    scheduleReopen()
    return
  }

  dialogInstance.value = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1110',
    },
    handleCancel: onDismiss,
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          // hideModal 本身不走 handleCancel；此处显式收尾，scheduleReopen 幂等
          hideModal()
          onDismiss()
        },
        onConfirm: () => {
          onCharge()
          router.push({ name: 'wallet' })
        },
      }),
    },
  })
}

function scheduleReopen() {
  if (countdown.value)
    return

  const stored = Number(sessionStorage.getItem(nextOpenStorageKey))
  const hasStored = Number.isFinite(stored) && stored > 0

  // 已到点：清时间戳并立刻再弹
  if (hasStored && stored <= Date.now()) {
    sessionStorage.removeItem(nextOpenStorageKey)
    openModal(true)
    return
  }

  const nextOpenAt = hasStored ? stored : Date.now() + REOPEN_INTERVAL_MS
  if (!hasStored)
    sessionStorage.setItem(nextOpenStorageKey, String(nextOpenAt))

  countdown.value = enhanceCountdown(nextOpenAt, () => { }, {
    onEnd: () => {
      countdown.value = undefined
      sessionStorage.removeItem(nextOpenStorageKey)
      openModal(true)
    },
  })
}

function onCharge() {
  walletRecharge({
    next: (data) => {
      openProcessing(data, OrderType.Recharge)
        .finally(() => {
          emitter.emit('updateBillList')
          getUserPayInfo()
        })
    },
  })
}
</script>

<template>
  <div class="cursor-pointer" @click="openModal(true)">
    <div class="relative h-9 flex items-center justify-center rounded-1.5 select-none overflow-hidden">
      <div v-if="collapsed" class="w-full aspect-square flex items-center justify-center icon">
        {{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}
      </div>
      <template v-else>
        <div class="relative w-full px-3 z-1 text">
          {{ $t('充值最高赠送 {value}', { value: `${maxBonus}%` }) }}
        </div>
        <img draggable="false" class="absolute inset-0 h-full" :src="imageSrc">
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text {
  color: #111213;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
}

.icon {
  color: #111213;
  font-family: 'DingTalk JinBuTi';
  font-size: 10px;
  text-align: center;
  background: linear-gradient(93deg, #d7eefe 0%, #9bd6fd 106.84%);
}
</style>
