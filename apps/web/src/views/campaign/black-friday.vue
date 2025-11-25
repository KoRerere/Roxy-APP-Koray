<script setup lang="ts">
import BlackFridayModal from '/@/views/campaign/black-friday-modal.vue';
import { useUserStore } from '/@/stores/user';
import { useCampaignStore } from '/@/stores/campaign';
import { useDialog } from '/@/hooks/useDialog'
import { emitter } from "/@/utils/eventBus"
import { enhanceCountdown, safeParseJSON } from '/@/utils/basic'
import { SubLevelEnum } from '/@/enums/pay';

const { collapsed } = defineProps<{
  collapsed: boolean
}>()

const router = useRouter()
const campaignStore = useCampaignStore()
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const [showModal] = useDialog()

const stopCountdown = ref()
const countdown = ref()
const modalStatus = ref(safeParseJSON(localStorage.getItem('$BlackFridayModalStatus')) || {
  lessThan24Hours: false,
  lessThan72Hours: false,
  openModal: false,
})

onBeforeMount(() => {
  getTimeLeft()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function getTimeLeft() {
  await Promise.all([campaignStore.getBlackFridayInfo(), getUserPayInfo()])

  if (campaignStore.blackFridayInfo && Date.now() < campaignStore.blackFridayInfo.start_timestamp) {
    stopCountdown.value = enhanceCountdown(campaignStore.blackFridayInfo.start_timestamp, () => { }, {
      onEnd: () => {
        stopCountdown.value.stop()
        getTimeLeft()
      }
    })
    return
  }

  if (!campaignStore.blackFridayPeriod || !campaignStore.blackFridayInfo) return

  stopCountdown.value = enhanceCountdown(campaignStore.blackFridayInfo.end_timestamp, (time) => {

    countdown.value = time
    if (time.done) {
      campaignStore.blackFridayPeriod = false
      return
    }

    const lessThan24Hours = (campaignStore.blackFridayInfo!.end_timestamp - Date.now()) < 24 * 60 * 60 * 1000
    const lessThan72Hours = (campaignStore.blackFridayInfo!.end_timestamp - Date.now()) < 72 * 60 * 60 * 1000

    if (
      (lessThan24Hours && !modalStatus.value.lessThan24Hours) ||
      (lessThan72Hours && !modalStatus.value.lessThan72Hours) ||
      !modalStatus.value.openModal
    ) {
      modalStatus.value = { lessThan24Hours, lessThan72Hours, openModal: true }
      localStorage.setItem('$BlackFridayModalStatus', JSON.stringify(modalStatus.value))
      if (!userPayInfo.value.isBlackFriday) openModal()
    }
  }, { lessThan24Interval: 1 / 60, alwaysSecondLevel: modalStatus.value.lessThan24Hours })
}

function goToSubscribePlan() {
  const isSubscribe = [SubLevelEnum.Free, SubLevelEnum.Trial, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum)
  if (isSubscribe) {
    router.push({ name: 'subscribe-plan' })
  } else if (userPayInfo.value.isBlackFriday) {
    router.push({ name: 'upgrade-plan' })
  } else {
    emitter.emit('showRenewalDialog', {
      paySuccess: () => {
        router.replace({ name: 'wallet', query: { name: 'manage' } })
        emitter.emit('updateBillList')
      }
    })
  }
}

function openModal() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!bg-transparent !border-none !shadow-none",
    },
    slots: {
      container: ({ hideModal }) => h(BlackFridayModal, {
        onClose: hideModal,
        onConfirm: goToSubscribePlan,
      })
    },
  })
}
</script>

<template>
  <div v-if="campaignStore.blackFridayPeriod" @click="goToSubscribePlan">
    <img v-if="collapsed" class="block rounded aspect-ratio-1" src="/images/campaing/black-friday/70OFF.svg">
    <div v-else class="flex flex-col py-2 px-2.5 gap-1.5 cursor-pointer friday">
      <div class="flex items-center justify-between">
        <span class="title">{{ $t('黑色星期五 3 折钜惠') }}</span>
        <SvgIcon name="base/rx_ic_arrow_right" color="#fff"></SvgIcon>
      </div>
      <template v-if="countdown">
        <i18n-t v-if="modalStatus.lessThan24Hours" class="desc" scope="global" tag="div" :keypath="$t('离促销结束 {count}', { count: '{count}' })">
          <template #count>
            <span class="time">{{ countdown.hours.toString().padStart(2, '0') }}:{{ countdown.minutes.toString().padStart(2, '0') }}:{{ countdown.seconds.toString().padStart(2, '0') }}</span>
          </template>
        </i18n-t>
        <i18n-t v-else class="desc" scope="global" tag="div" :keypath="$t('剩余 {day} 天 {hours} 小时', { day: '{day}', hours: '{hours}' })">
          <template #day>
            <span class="time">{{ countdown.days.toString().padStart(2, '0') }}</span>
          </template>
          <template #hours>
            <span class="time">{{ countdown.hours.toString().padStart(2, '0') }}</span>
          </template>
        </i18n-t>
      </template>
    </div>
  </div>
</template>

<style scoped>
.friday {
  border-radius: 6px;
  background-color: #000;
  background-image: url('/images/campaing/black-friday/card-bg-s.svg');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

.title {
  color: #FFF;
  font-size: 12px;
  font-weight: 700;
  line-height: normal;
}

.desc {
  color: rgba(255, 255, 255, 0.80);
  font-size: 12px;
  line-height: normal;
}

.time {
  color: #FFF;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}
</style>
