<script setup lang="ts">
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
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

const router = useRouter()
const { currentLocale } = storeToRefs(useSimpleLocale())
const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const [showModal] = useDialog()
// const { mixpanelTrack } = useUserStore()

const countdown = ref()
const opened = ref(safeParseJSON(sessionStorage.getItem(localStorageKey)))

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  return getImage(`campaing/june-eighteen/mini_${suffix}.png`)
})

onMounted(() => {
  openModal()
})

function openModal(force = false) {
  if (!force && opened.value) {
    openAgainBy24Hours()
    return
  }

  if (!seasonalActivity.value.juneEighteen)
    return

  // if (force) {
  //   mixpanelTrack('june_eighteen_2026', { june_eighteen_entrance_type: 'App' })
  // }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
      mask: '!z-1110',
    },
    handleCancel: () => {
      openAgainBy24Hours()
    },
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          hideModal()
          sessionStorage.setItem(localStorageKey, JSON.stringify(true))
        },
        onConfirm: () => {
          onCharge()
          router.push({ name: 'wallet' })
        },
      }),
    },
  })
}

function openAgainBy24Hours() {
  if (countdown.value)
    return

  const day = Date.now() + 1000 * 60 * 60 * 24
  countdown.value = enhanceCountdown(day, () => { }, {
    onEnd: () => {
      countdown.value = undefined
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
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
}

.icon {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 10px;
  text-align: center;
  background: linear-gradient(225deg, #05caed -27.78%, #000 97.21%);
}
</style>
