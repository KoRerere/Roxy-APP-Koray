<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import currency from 'currency.js';
import TierSlider from '/@/views/pay/subscribe/components/tier-slider.vue'
import SubscribePlans from '/@/views/pay/subscribe/components/subscribe-plans.vue'
import Illustrate from '/@/views/pay/subscribe/components/illustrate.vue'
import { $t } from '/@/locales'
import { getStep, ceilByStep } from '../util'
import { type Plan } from '../type'

const popoverRef = useTemplateRef('popover')

interface Props {
  min?: number
  max?: number
  list: Plan[]
}

const { list } = defineProps<Props>()

const selectedPlan = defineModel<Plan>('plan')
const selectedCount = defineModel<number>('count', { required: true })
const tiersList = computed(() => (list || []).map(({ minWindows, maxWindows }) => ({ start: minWindows, end: maxWindows, step: getStep(minWindows) })))

const step = ref(10)

function onChangePlan(plan: Plan) {
  selectedCount.value = plan.maxWindows
}

function onChangeCount(value: number) {
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
    : ceilByStep(_value, getStep(_value, math))

  nextTick(() => {
    selectedCount.value = count
    onChangeCount(count)
  })
}

function onBeforePlus(value: number) {
  step.value = getStep(value, 'plus')
  return true
}

function onBeforeMinus(value: number) {
  step.value = getStep(value, 'minus')
  return true
}

function showIllustrate(event: Event) {
  popoverRef.value!.getRef().toggle(event)
}

</script>

<template>
  <div>
    <SubscribePlans :list="list" v-model="selectedPlan" @change="onChangePlan"></SubscribePlans>
    <div class="flex flex-col gap-3 mt-6 pb-18">
      <div class="title">{{ $t('滑动以选择窗口数量') }}</div>
      <TierSlider v-model="selectedCount" :min="min ?? tiersList[1].start"
        :max="max ?? tiersList[tiersList.length - 1].end" :tiers="tiersList" @change="onChangeCount">
        <template #thumb-extra>
          <div ref="current" class="flex flex-col gap-1 items-center whitespace-nowrap current" v-if="selectedPlan">
            <div>
              <span class="current-unit">$</span>
              <NumberFlow :spinTiming="{ duration: 550 }" :opacityTiming="{ duration: 250 }" willChange
                class="ml-1 current-price" :value="selectedPlan.windowPrice"></NumberFlow>
              <span class="ml-2.5 current-text">/{{ $t('窗口') }}</span>
            </div>
            <div class="current-desc">{{ $t('窗口单价（{value} 数量区间）', {
              value: `${selectedPlan.minWindows +
                1}~${selectedPlan.maxWindows}`
            }) }}</div>
          </div>
        </template>
      </TierSlider>
    </div>
    <div class="flex items-center justify-between py-8">
      <div class="flex items-center gap-1.5">
        <span class="sub-title">{{ $t('窗口数量') }}</span>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="#C7CDD1" @click="showIllustrate"></SvgIcon>
      </div>
      <RxStep size="lg" class="!w-40" v-model="selectedCount!" :min="min ?? tiersList[1].start"
        :max="max ?? tiersList[tiersList.length - 1].end" :step="step" :beforePlus="onBeforePlus"
        :beforeMinus="onBeforeMinus" @change="onChangeCount" @update:modelValue="onUpdate"></RxStep>
    </div>
    <RyPopover ref="popover">
      <Illustrate v-if="list" :data="list"></Illustrate>
    </RyPopover>
  </div>
</template>

<style scoped lang="scss">
:deep(.rx-input-number.p-inputnumber) {
  height: 40px;
}

:deep(.plans) {
  flex: 2;

  &:first-of-type {
    flex: 1;
  }
}

.title {
  color: var(--colors-text-text-tertiary, #8A9093);
  font-family: Inter;
  font-size: 14px;
  line-height: normal;
}

.current {
  &-price {
    color: var(--Color-yellow-300, #FC9D12);
    font-family: Inter;
    font-size: 36px;
    font-weight: 600;
    line-height: normal;
  }

  &-unit {
    color: var(--Color-yellow-300, #FC9D12);
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
    color: var(--Colors-Text-text-inactive, #A3A9AD);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.sub-title {
  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}
</style>
