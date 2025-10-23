<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import currency from 'currency.js';
import TierSlider from '/@/views/pay/subscribe/components/tier-slider.vue'
import SubscribePlans from '/@/views/pay/subscribe/components/subscribe-plans.vue'
import Illustrate from '/@/views/pay/subscribe/components/illustrate.vue'
import { $t } from '/@/locales'
import { formatNumberToKMB } from '/@/utils/basic';
import { ceilByStep } from '../util'
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay';
import { type Plan } from '../type'

const popoverRef = useTemplateRef('popover')

interface Props {
  min?: number
  max?: number
  list: Plan[]
  rawList: Plan[]
}

interface Tier {
  start: number
  end: number
  step: number
}

const { list, rawList } = defineProps<Props>()

const selectedPlan = defineModel<Plan>('plan')
const selectedCount = defineModel<number>('count', { required: true })

const step = ref(10)

const tiersData = computed(() => {
  const MAX_STEP = 100
  return (list || []).reduce((acc, { minWindows, maxWindows }) => {
    const step = Math.min(maxWindows - minWindows, MAX_STEP)
    if (minWindows <= MAX_STEP) acc.steps.set(minWindows, step)
    acc.tiers.push({ start: minWindows, end: maxWindows, step })
    return acc
  }, { tiers: [], steps: new Map() } as { tiers: Tier[], steps: Map<number, number> })
})
const tiersList = computed(() => tiersData.value.tiers)
const tiersSteps = computed(() => [...tiersData.value.steps])

const planInfo = computed(() => {
  if (!selectedPlan.value) return

  const { subLevel, windowPrice, minWindows, maxWindows } = selectedPlan.value

  const isTrial = subLevel === SubLevelEnum.Trial

  const description = isTrial
    ? $t('窗口单价（试用价格）')
    : $t('窗口单价（{value} 数量区间）', { value: `${(minWindows < 10 ? 0 : minWindows) + 1}~${maxWindows}` })

  return { isTrial, windowPrice, description }
})

function tooltipFormatter(value: number) {
  if (selectedPlan.value?.subLevel === SubLevelEnum.Trial) {
    return $t('{count} 个窗口', { count: 10 }) + ' ' + `(${SubLevelEnumStr[SubLevelEnum.Trial]})`
  }
  return $t('{count} 个窗口', { count: formatNumberToKMB(value) })
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
  const _value = Math.max(currency(value).value, tiersList.value[1].start)
  const count = _value < 100
    ? tiersList.value.findLast(item => _value > item.start)!.end
    : ceilByStep(_value, getTiersStep(_value, math))

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
    <SubscribePlans :list="list" v-model="selectedPlan" @change="onPlanChange"></SubscribePlans>
    <div class="flex flex-col gap-3 mt-6 pb-18">
      <div class="title">{{ $t('滑动以选择窗口数量') }}</div>
      <TierSlider v-model="selectedCount" :min="min ?? tiersList[1].start" :max="max ?? tiersList[tiersList.length - 1].end" :tiers="tiersList" :hideLabels="[5]" :tooltipFormatter="tooltipFormatter"
        @change="onChange">
        <template #thumb-extra>
          <div ref="current" class="flex flex-col gap-1 items-center whitespace-nowrap current" v-if="planInfo">
            <div>
              <span class="current-unit">$</span>
              <NumberFlow :spinTiming="{ duration: 550 }" :opacityTiming="{ duration: 250 }" willChange class="ml-1 current-price" :value="planInfo.windowPrice"></NumberFlow>
              <span class="ml-2.5 current-text">/{{ $t('窗口') }}</span>
            </div>
            <div class="current-desc">{{ planInfo.description }}</div>
          </div>
        </template>
      </TierSlider>
    </div>
    <div v-if="!planInfo?.isTrial" class="flex items-center justify-between pt-8">
      <div class="flex items-center gap-1.5">
        <span class="sub-title">{{ $t('窗口数量') }}</span>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" @click="showIllustrate"></SvgIcon>
      </div>
      <RxStepInput size="lg" class="!w-40" v-model="selectedCount!" :min="min ?? Math.max(tiersList[1].start, 10)" :max="max ?? tiersList[tiersList.length - 1].end" :step="step"
        :beforePlus="onBeforePlus" :beforeMinus="onBeforeMinus" @change="onChange" @update:modelValue="onUpdate"></RxStepInput>
    </div>
    <RyPopover ref="popover">
      <Illustrate :data="rawList"></Illustrate>
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
    color: var(--primitives-yellow-500, #FC9D12);
    font-family: Inter;
    font-size: 36px;
    font-weight: 600;
    line-height: normal;
  }

  &-unit {
    color: var(--primitives-yellow-500, #FC9D12);
    font-family: Inter;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-text {
    color: var(--colors-text-text-primary, #FAFAFA);
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

.sub-title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}
</style>
