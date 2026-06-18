<script setup lang="ts">
import { getImage, safeParseJSON } from '/@/utils/basic'
import ActivityModal from './activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useUserStore } from '/@/stores/user'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { emitter } from '/@/utils/eventBus'
import { OrderType } from '/@/enums/pay'

const { collapsed = false, localStorageKey } = defineProps<{
  collapsed?: boolean
  localStorageKey: string
}>()

const router = useRouter()
const { currentLocale } = storeToRefs(useSimpleLocale())
const { maxBonus } = storeToRefs(useCampaignStore())
const { getUserPayInfo } = useUserStore()
const { walletRecharge, openProcessing } = usePay()
const [showModal] = useDialog()
// const { mixpanelTrack } = useUserStore()

const opened = ref(safeParseJSON(localStorage.getItem(localStorageKey)))

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  return getImage(`campaing/june-eighteen/mini_${suffix}.png`)
})

onMounted(() => {
  openModal()
})

function openModal(force = false) {
  if (!force && opened.value)
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
    slots: {
      container: ({ hideModal }) => h(ActivityModal, {
        onClose: () => {
          hideModal()
          localStorage.setItem(localStorageKey, JSON.stringify(true))
        },
        onConfirm: () => {
          onCharge()
          router.push({ name: 'wallet' })
        },
      }),
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
