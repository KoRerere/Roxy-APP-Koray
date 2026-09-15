<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import currency from 'currency.js'
import TierSlider from '/@/views/pay/subscribe/components/tier-slider.vue'
import SubscribePlans from '/@/views/pay/subscribe/components/subscribe-plans.vue'
import Illustrate from '/@/views/pay/subscribe/components/illustrate.vue'
import { formatNumberToKMB } from '/@/utils/basic'
import { alignSubscribeCount, formatTierData } from '../util'
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay'
import { useCampaignStore } from '/@/stores/campaign'
import { useUserStore } from '/@/stores/user'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
import type { Plan } from '../type'

interface Props {
  min?: number
  max?: number
  list: Plan[]
  rawList: Plan[]
}

const { list, rawList } = defineProps<Props>()

const popoverRef = useTemplateRef('popover')

const { seasonalActivity } = storeToRefs(useCampaignStore())
const { userPayInfo } = storeToRefs(useUserStore())
const billingLabels = useBillingEntityLabels()

const selectedPlan = defineModel<Plan>('plan')
const selectedCount = defineModel<number>('count', { required: true })

const step = ref(10)

const tiersData = computed(() => formatTierData(list))
const tiersList = computed(() => tiersData.value.tiers)
const tiersSteps = computed(() => [...tiersData.value.steps])

const planInfo = computed(() => {
  if (!selectedPlan.value) {
    return
  }

  const { subLevel, windowPrice, minWindows, maxWindows } = selectedPlan.value

  const isTrial = subLevel === SubLevelEnum.Trial

  const description = isTrial
    ? billingLabels.value.entityUnitPriceTrial
    : billingLabels.value.entityUnitPriceTier(`${(minWindows < 10 ? 0 : minWindows) + 1}~${maxWindows}`)

  return { isTrial, windowPrice, description }
})

/** 与套餐详情一致：购买后每日额度 = (付费窗口 + 免费窗口) × 30 / 100 */
const dailyQuota = computed(() => {
  const paidWindowCount = planInfo.value?.isTrial ? Math.max(selectedCount.value, 10) : selectedCount.value
  const profileCount = currency(paidWindowCount, { precision: 0, symbol: '' })
  const freeCount = currency(userPayInfo.value.freeWindowCount, { precision: 0, symbol: '' })
  const totalWindows = profileCount.add(freeCount.value)

  return {
    create: totalWindows.multiply(30).format(),
    open: totalWindows.multiply(100).format(),
  }
})

function tooltipFormatter(value: number) {
  if (selectedPlan.value?.subLevel === SubLevelEnum.Trial) {
    return `${billingLabels.value.countEntities(10)} ` + `(${SubLevelEnumStr[SubLevelEnum.Trial]})`
  }
  return billingLabels.value.countEntities(formatNumberToKMB(value))
}

function getTiersStep(value: number, math: 'plus' | 'minus' = 'plus') {
  return tiersSteps.value.findLast(([min]) => math === 'plus' ? value >= min : value > min)?.[1] || 10
}

function onPlanChange(maxWindows: number) {
  selectedCount.value = maxWindows
  onChange(maxWindows)
}

function onChange(value: number) {
  if (value && !(selectedPlan.value!.minWindows < value && value <= selectedPlan.value!.maxWindows)) {
    const plan = list!.findLast(item => value > item.minWindows)
    if (plan) {
      selectedPlan.value = plan
    }
  }
}

function onUpdate(value: number) {
  const math = value > selectedCount.value! ? 'plus' : 'minus'
  const _value = Math.max(currency(value).value, tiersList.value[1]!.start)
  const count = alignSubscribeCount(_value, tiersList.value, getTiersStep(_value, math))

  nextTick(() => {
    selectedCount.value = count
    onChange(count)
  })
}

function onBeforePlus(value: number) {
  step.value = getTiersStep(value, 'plus')
  return true
}

function onBeforeMinus(value: number) {
  step.value = getTiersStep(value, 'minus')
  return true
}

function showIllustrate(event: Event) {
  popoverRef.value?.instance?.toggle(event)
}
</script>

<template>
  <div>
    <SubscribePlans v-model="selectedPlan" :list="list" @change="onPlanChange" />
    <div class="flex flex-col gap-3 mt-6 pb-18">
      <div class="title">
        {{ billingLabels.selectEntityCount }}
      </div>
      <TierSlider v-model="selectedCount" :min="min ?? tiersList[1]!.start" :max="max ?? tiersList[tiersList.length - 1]!.end" :tiers="tiersList" :hide-labels="[5]"
                  :tooltip-formatter="tooltipFormatter" @change="onChange"
      >
        <template v-if="seasonalActivity.newYear" #thumb-icon>
          <SvgIcon class="absolute inset-0 scale-200" name="other/flower" />
        </template>
        <template #thumb-extra>
          <div v-if="planInfo" class="flex flex-col gap-1 items-center whitespace-nowrap current">
            <div>
              <span class="current-unit">$</span>
              <NumberFlow :spin-timing="{ duration: 550 }" :opacity-timing="{ duration: 250 }" will-change class="ml-1 current-price" :value="planInfo.windowPrice" />
              <span class="ml-2.5 current-text">/{{ billingLabels.entityUnit }}</span>
            </div>
            <div class="current-desc">
              {{ planInfo.description }}
            </div>
          </div>
        </template>
      </TierSlider>
    </div>
    <div class="flex flex-col gap-1 pt-8">
      <div v-if="!planInfo?.isTrial" class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="tt-primary text-4 font-600 leading-5">{{ billingLabels.entityCount }}</span>
          <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" @click="showIllustrate" />
        </div>
        <RxStepInput v-model="selectedCount!" size="lg" class="!w-40" :min="min ?? Math.max(tiersList[1]!.start, 10)" :max="max ?? tiersList[tiersList.length - 1]!.end" :step="step"
                     :before-plus="onBeforePlus" :before-minus="onBeforeMinus" @update:model-value="onUpdate"
        />
      </div>
      <div class="h-10 flex items-center justify-between">
        <span class="tt-primary text-4 leading-5">{{ $t('每日可创建数') }}</span>
        <div class="!w-56 flex items-center justify-center">
          {{ dailyQuota.create }}
        </div>
      </div>
      <div class="h-10 flex items-center justify-between">
        <span class="tt-primary text-4 leading-5">{{ $t('每日可打开数') }}</span>
        <div class="!w-56 flex items-center justify-center">
          {{ dailyQuota.open }}
        </div>
      </div>
    </div>
    <RyPopover ref="popover">
      <Illustrate :data="rawList" />
    </RyPopover>
  </div>
</template>

<style scoped lang="scss">
:deep(.rx-input-number.p-inputnumber) {
  height: 40px;
}

.title {
  color: var(--colors-text-text-secondary);
  font-family: Inter;
  font-size: 14px;
  line-height: normal;
}

.current {
  &-price {
    color: var(--primitives-yellow-500, #fc9d12);
    font-family: Inter;
    font-size: 36px;
    font-weight: 600;
    line-height: normal;
  }

  &-unit {
    color: var(--primitives-yellow-500, #fc9d12);
    font-family: Inter;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-text {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 16px;
    font-weight: 500;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.quota-value {
  color: var(--colors-text-text-secondary, #34393d);
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
}
</style>
