<script setup lang="ts">
import ActivityRule from '/@/views/campaign/spring-festival/activity-rule.vue'
import currency from 'currency.js'
import { $t } from '/@/locales'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useDialog } from '/@/hooks/useDialog'
import { RoxyGiftsType } from '/@/enums/pay'
import { genDriver, safeParseJSON, sleep } from '/@/utils'

const { amount, giftProfile } = defineProps<{
  amount: number
  giftProfile?: Record<string, any>
}>()

const { currentLocale } = storeToRefs(useSimpleLocale())
const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())

const [showModal] = useDialog()

const CID = getCurrentInstance()?.uid

const giftType = defineModel()
const driverStatus = safeParseJSON(localStorage.getItem('driverStatus'))

const options = computed(() => {
  if (!seasonalActivity.value.springFestival)
    return []

  const { staff, profile, amount: unitPrice } = currentActivity.value

  const count = currency(Math.floor(amount / unitPrice)).multiply(staff.count).value

  const staffDisabled = amount < currentActivity.value.amount
  return [
    {
      label: $t('{count} 团队成员', { count }),
      desc: staffDisabled
        ? $t('消费满 {amount} 即可解锁奖励', { amount: currency(currentActivity.value.amount).format() })
        : $t('每满 {amount} 多送 {count} 个，赠送无上限', { amount: currency(unitPrice).format(), count: staff.count }),
      value: RoxyGiftsType.Staff,
      disabled: staffDisabled,
      visible: staff.enable,
    },
    {
      label: $t('兑换码 ({count} 窗口，{month} 个月)', { count: giftProfile?.count, month: giftProfile?.month }),
      desc: $t('兑换码有效期 {day} 天（仅限当前无生效中的订阅用户可用）', { day: profile.expireDays }),
      value: RoxyGiftsType.Profile,
      visible: !!giftProfile && profile.enable,
    },
  ].filter(item => item.visible !== false)
})

const gifts = computed(() => {
  if (!seasonalActivity.value.springFestival)
    return {}
  const isOk = (amount >= currentActivity.value.amount) || !!giftProfile
  const suffix = ['en', 'ru'].includes(currentLocale.value!) ? 'en' : 'zh-CN'

  return {
    isOk,
    titleImage: `/images/campaing/spring-festival/purchase_title_${suffix}.svg`,
  }
})

watch(() => amount, (value) => {
  if (value < currentActivity.value.amount) {
    giftType.value = giftProfile ? RoxyGiftsType.Profile : undefined
  }
  else {
    giftType.value ??= RoxyGiftsType.Staff
  }
}, { immediate: true })

onMounted(() => {
  driverHighlight()
})

async function driverHighlight() {
  if (!seasonalActivity.value.active || driverStatus?.springFestival)
    return

  await Promise.all([
    sleep(50), // 延迟 50ms 让外部元素加载完成
    nextTick(),
  ])

  const driverObj = genDriver({
    steps: [
      { element: '#gifts', popover: { description: $t('您现在每次消费，即可获得我们提供的礼物作为赠品，多买多送。'), side: 'left', align: 'center' } },
    ],
    onDestroyed: () => {
      localStorage.setItem('driverStatus', JSON.stringify({ ...driverStatus, springFestival: true }))
    },
  })

  driverObj.drive()
}

function giftRule() {
  if (!seasonalActivity.value.springFestival)
    return

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(ActivityRule, {
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <div v-if="seasonalActivity.springFestival" id="gifts" class="relative flex flex-col gap-6 pa-4 rounded-2 overflow-hidden content">
    <img class="absolute -top-0.5 -right-12 opacity-15 z-0 w-34" src="/images/campaing/spring-festival/uspicious_cloud.svg">
    <div class="relative flex items-center justify-between z-1">
      <img draggable="false" :src="gifts.titleImage">
      <div class="flex items-center gap-0.5 cursor-pointer" @click="giftRule">
        <span class="desc">{{ $t('详情') }}</span>
        <SvgIcon class="opacity-40" name="base/rx_ic_info" size="12" color="#ffffff" />
      </div>
    </div>
    <div class="relative flex flex-col gap-3 z-1">
      <label v-for="item in options" :key="item.value" class="flex items-start gap-1.5 select-none cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': item.disabled }"
             :for="`${CID}_${item.value}`"
      >
        <RadioButton v-model="giftType" :disabled="item.disabled" class="!hidden" :input-id="`${CID}_${item.value}`" :value="item.value" name="gifts" />
        <div class="shrink-0 radio" :class="{ checked: giftType === item.value }" />
        <div>
          <div class="label">{{ item.label }}</div>
          <div v-if="item.desc" class="opacity-70 desc">{{ item.desc }}</div>
        </div>
      </label>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background:
    radial-gradient(101.35% 75.07% at 50% 100%, rgba(246, 104, 55, 0.9) 0%, rgba(246, 104, 55, 0) 100%), #d52110;
}

.title {
  color: #ffffff;
  font-family: 'Archivo Expanded';
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.desc {
  color: #ffffff;
  font-size: 12px;
  line-height: normal;
}

.radio {
  position: relative;
  width: 16px;
  height: 16px;
  border: 1px solid #fec66d;
  border-radius: 50%;

  &.checked {
    border-width: 2px;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      background: #fec66d;
      border-radius: 50%;
    }
  }
}

.label {
  color: #ffffff;
  font-size: 14px;
  line-height: 16px;
}
</style>
