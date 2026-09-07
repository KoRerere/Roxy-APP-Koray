<script setup lang="tsx">
import currency from 'currency.js'
import { format } from 'date-fns'

import { AutoRenewalStatus } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
import { useConfirmAutoRenew } from '/@/views/pay/wallet/components/useConfirmAutoRenew'

const emit = defineEmits<{
  (e: 'close', needUpdate: boolean): void
}>()

const [_, onlyErrorToast] = useResponseToast()
const { userPayInfo } = storeToRefs(useUserStore())
const billingLabels = useBillingEntityLabels()

const isAuto = ref(userPayInfo.value.isAuto)
const needUpdate = ref(false)
const currentPlan = ref<Array<{ label: string, value?: string, class?: string }>>([])
const { beforeToggleAutoRenew } = useConfirmAutoRenew()

onBeforeMount(() => {
  getCurrentPlan()
})

async function getCurrentPlan() {
  const { code, data, msg } = await API.pay.userGetAutoSubscriptionInfoList({ queryType: 'profile' })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }
  currentPlan.value = [
    {
      label: $t('价格'),
      value: currency(data.orderPrice).format(),
      class: 'font-600',
    },
    {
      label: billingLabels.value.entityCount,
      value: currency(data.windowCount, { precision: 0, symbol: '' }).format(),
    },
    {
      label: $t('订阅时长'),
      value: $t('{day} 天', { day: data.subscriptionDays }),
    },
    {
      label: $t('下一次账单日期'),
      value: format(data.nextTime, 'yyyy/MM/dd'),
    },
  ]
}

async function toggleAutoRenew() {
  const { code, msg } = await API.pay.userSetAutoRenewalStatusCreate({ status: Number(isAuto.value) })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    isAuto.value = userPayInfo.value.isAuto
    return
  }
  needUpdate.value = true
}

function close() {
  emit('close', needUpdate.value)
}
</script>

<template>
  <div class="w-96 flex flex-col pa-6 pt-4 gap-4">
    <div class="h-9 flex items-center justify-between">
      <span class="header">{{ $t('管理订阅') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="close" />
    </div>
    <div class="flex flex-col gap-3">
      <div class="sub-title flex items-center justify-between">
        <span class="title">{{ $t('自动续费') }}</span>
        <RxToggleSwitch v-model="isAuto" :true-value="AutoRenewalStatus.Open" :false-value="AutoRenewalStatus.Close" :before-change="beforeToggleAutoRenew" @change="toggleAutoRenew" />
      </div>
      <div class="desc">
        <div>{{ $t('续订费用将在订阅到期当日从您的钱包中扣除。') }}</div>
        <i18n-t class="whitespace-pre-wrap desc" tag="div" :keypath="$t('您可以提前向钱包储值，或{link}。', { link: '{link}' })" scope="global">
          <template #link>
            <span class="font-bold">{{ $t('启用自动续费组合支付') }}</span>
          </template>
        </i18n-t>
        <i18n-t class="whitespace-pre-wrap desc" tag="div" :keypath="$t('启用自动续费将享受 {discount}。', { discount: '{discount}' })" scope="global">
          <template #discount>
            <span class="discount">{{ $t('{discount}% Off', { discount: userPayInfo.autoRenewDiscount }) }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
    <RxDivider line-only />
    <div class="flex flex-col gap-2.5">
      <div class="title">
        {{ $t('当前套餐') }}
      </div>
      <div v-for="item in currentPlan" :key="item.label" class="flex items-center justify-between">
        <div class="text">
          {{ item.label }}
        </div>
        <div class="text" :class="item.class">
          {{ item.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.discount {
  color: var(--colors-text-text-warning);
  font-family: 'DingTalk JinBuTi';
}

.link {
  color: var(--colors-text-text-brand);
  font-size: 12px;
  line-height: 18px;
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}
</style>
