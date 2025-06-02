<script setup lang="tsx">
import NumberFlow from '@number-flow/vue'
import currency from 'currency.js';
import { addDays, format } from 'date-fns'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import SubscribePlans from '/@/views/pay/subscribe/components/subscribe-plans.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import AdvancedFeat from '/@/views/pay/subscribe/components/advanced-feat.vue'
import TierSlider from '/@/views/pay/subscribe/components/tier-slider.vue'
import { getStep } from './util'
import { useUserStore } from '/@/stores/user';
import { type Plan } from './type'
import { SubLevelEnum } from '/@/enums/pay';

const [showToast, onlyErrorToast] = useResponseToast()
const { userPayInfo } = storeToRefs(useUserStore())
const router = useRouter()

const dataList = ref<Plan[]>()

const tiersList = computed(() => (dataList.value || []).map(({ minWindows, maxWindows }) => ({ start: minWindows, end: maxWindows, step: getStep(minWindows) })))

const selectedPlan = ref()
const selectedCount = ref()

const details = computed(() => {
  const profileCount = currency(selectedCount.value, { precision: 0, symbol: '' })
  const freeWindowCount = currency(userPayInfo.value.freeWindowCount, { precision: 0, symbol: '' })

  return [
    {
      title: $t('套餐详情'),
      items: [
        {
          label: $t('窗口数量'),
          value: `${profileCount.format()} + ${freeWindowCount.format()}`
        },
        {
          label: $t('单价'),
          value: currency(selectedPlan.value?.windowPrice).format()
        },
        {
          label: $t('每日可创建数'),
          value: profileCount.add(freeWindowCount.value).multiply(30).format()
        },
        {
          label: $t('每日可打开数'),
          value: profileCount.add(freeWindowCount.value).multiply(100).format()
        },
        {
          label: $t('订阅时长'),
          value: $t('{day} 天', { day: 7 })
        },
      ]
    },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(8).format(),
          slot: 'oldprice'
        },
        {
          label: $t('实际价格'),
          value: currency(0).format(),
          slot: 'price'
        },
      ]
    }
  ]
})

onBeforeMount(() => {
  getTierPricingList()
})

async function getTierPricingList() {
  try {
    const { code, data, msg } = await API.pay.userGetWindowPricingRulesListList()
    if (code === 0) {
      dataList.value = data.rows.slice(0, 1).map(({ subLevel, ...item }) => ({ ...item, subLevel: SubLevelEnum.Trial }))
      selectedPlan.value = dataList.value[0]
      selectedCount.value = selectedPlan.value.maxWindows
    } else {
      throw new Error(msg)
    }
  } catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

function onChangePlan(plan: Plan) {
  selectedCount.value = plan.maxWindows
}

function onChangeCount(value: number) {
  if (value && !(selectedPlan.value.minWindows < value && value <= selectedPlan.value.maxWindows)) {
    const plan = dataList.value!.findLast(item => value > item.minWindows)
    if (plan) {
      selectedPlan.value = plan
    }
  }
}

async function onSubscribe() {
  const { code, msg } = await API.pay.userSevenDayTrialCreate({})
  onlyErrorToast(code, msg)
  if (code === 0) {
    showToast(code, $t('成功激活试用'))
    router.push({ name: 'browser-list' })
  }
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader :title="$route.meta.title" />
    <div class="rx-container">
      <div class="flex flex-1 items-start gap-15 px-19.5 pt-6 overflow-y-auto">
        <div class="flex-1">
          <SubscribePlans :list="dataList!" v-model="selectedPlan" @change="onChangePlan"></SubscribePlans>
          <div class="flex flex-col gap-3 mt-6" v-if="dataList?.length">
            <div class="slider">{{ $t('窗口数量') }}</div>
            <TierSlider v-model="selectedCount" :min="10" :max="10" :tiers="tiersList" @change="onChangeCount" />
          </div>
          <div class="flex flex-col items-center pt-4 pb-6 current" v-if="selectedPlan">
            <div>
              <span class="current-unit">$</span>
              <NumberFlow :spinTiming="{ duration: 550 }" :opacityTiming="{ duration: 250 }" willChange class="ml-1 current-price" :value="selectedPlan.windowPrice"></NumberFlow>
              <span class="ml-2.5 current-text">/{{ $t('窗口') }}</span>
            </div>
            <div class="mt-1 current-desc">{{ $t('窗口单价（{value} 数量区间）', {
              value: `${selectedPlan.minWindows + 1}~${selectedPlan.maxWindows}`
            }) }}</div>
          </div>
          <div class="flex items-center justify-between py-8" v-if="dataList?.length">
            <div class="flex items-center sub-title">{{ $t('窗口数量') }}</div>
            <RxStep readonly size="lg" class="!w-40" v-model="selectedCount" :min="10" :max="10" />
          </div>
          <div class="flex justify-between items-center py-8 border-0 border-t border-dashed border-[var(--colors-border-divider-dashed)]">
            <div class="flex items-center gap-2 sub-title">
              <span>{{ $t('试用时长') }}</span>
            </div>
            <div class="period">{{ $t('截止 {value}', { value: format(addDays(Date.now(), 7), 'yyyy/MM/dd') }) }}</div>
          </div>
          <AdvancedFeat :plan="selectedPlan" class="py-8 border-0 border-t border-dashed border-[var(--colors-border-divider-dashed)]">
          </AdvancedFeat>
        </div>
        <Detail class="w-88" :list="details">
          <template #oldprice="{ item }">
            <div class="flex justify-between">
              <div class="details-label">{{ item.label }}</div>
              <div class="details-oldprice">{{ item.value }}</div>
            </div>
          </template>
          <template #price="{ item }">
            <div class="flex justify-between items-center details">
              <div class="details-label">{{ item.label }}</div>
              <div class="flex items-center">
                <span class="details-price">{{ item.value }}</span>
              </div>
            </div>
          </template>
          <template #after>
            <div class="flex-1 flex flex-col justify-end mt-3 gap-3">
              <RxButton size="lg" :label="$t('开始免费试用')" @click="onSubscribe"></RxButton>
            </div>
          </template>
        </Detail>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.rx-input-number.p-inputnumber) {
  height: 40px;
}

.slider {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 14px;
  line-height: normal;
}

.sub-title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.period {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 14px;
  line-height: 20px;
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
    color: var(--colors-text-text-inactive, #A3A9AD);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.details {
  &-label {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-price {
    color: #12A3FC;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-oldprice {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
    text-decoration-line: line-through;
  }
}
</style>
