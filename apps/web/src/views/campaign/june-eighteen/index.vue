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

const REOPEN_INTERVAL_MS = 1000 * 60 * 60 * 8
const activityNextOpenStorageKey = `${localStorageKey}:nextOpen`

const router = useRouter()
const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const [showModal] = useDialog()

const activityCountdown = ref<ReturnType<typeof enhanceCountdown>>()
const dialogInstance = ref<UseDialogInstance>()
const activityOpened = ref(safeParseJSON(sessionStorage.getItem(localStorageKey)))

const imageSrc = computed(() => {
  return getImage(`campaing/june-eighteen/mini.png`)
})

onMounted(() => {
  requestModal()
})

onBeforeUnmount(() => {
  activityCountdown.value?.stop()
  activityCountdown.value = undefined
  void dialogInstance.value?.hideModal()
})

function markDismissed() {
  activityOpened.value = true
  sessionStorage.setItem(localStorageKey, JSON.stringify(true))
}

function onDismiss() {
  dialogInstance.value = undefined
  markDismissed()
  scheduleReopen()
}

function requestModal(force = false) {
  if (!seasonalActivity.value.juneEighteen || dialogInstance.value)
    return

  if (!force && activityOpened.value) {
    scheduleReopen()
    return
  }

  openActivityModal()
}

function openActivityModal() {
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
          void hideModal().then(closed => closed && onDismiss())
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
  if (activityCountdown.value)
    return

  const stored = Number(sessionStorage.getItem(activityNextOpenStorageKey))
  const hasStored = Number.isFinite(stored) && stored > 0

  if (hasStored && stored <= Date.now()) {
    sessionStorage.removeItem(activityNextOpenStorageKey)
    requestModal(true)
    return
  }

  const nextOpenAt = hasStored ? stored : Date.now() + REOPEN_INTERVAL_MS
  if (!hasStored)
    sessionStorage.setItem(activityNextOpenStorageKey, String(nextOpenAt))

  activityCountdown.value = enhanceCountdown(nextOpenAt, () => { }, {
    onEnd: () => {
      activityCountdown.value = undefined
      sessionStorage.removeItem(activityNextOpenStorageKey)
      requestModal(true)
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
  <div class="cursor-pointer" @click="requestModal(true)">
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
