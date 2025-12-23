<script setup lang="ts">
import currency from 'currency.js'
import { addDays, format } from 'date-fns'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import type { Duration } from '/@/views/pay/subscribe/type'

const { price } = defineProps<{
  price: number
}>()

const emit = defineEmits<{
  (e: 'change', duration: Duration): void
}>()

const { userPayInfo } = storeToRefs(useUserStore())
const [_, onlyErrorToast] = useResponseToast()

const selectedDuration = defineModel<Duration>('modelValue')

const durationList = ref<Duration[]>()
const loading = ref(false)

const durationsDiscountPrice = computed(() =>
  Object.fromEntries(
    (durationList.value || []).map(({ key, discount, month }: any) =>
      [key, Math.abs(currency(price).multiply(discountCalculate([discount])).subtract(price).multiply(month).value)]),
  ),
)

onBeforeMount(() => {
  getDiscountByDuration()
})

async function getDiscountByDuration() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetDurationDiscountsList()
  loading.value = false
  onlyErrorToast(code, msg)

  if (code !== 0)
    return

  durationList.value = Object.entries(data).map(([month, discount]) => ({
    discount,
    month: Number(month),
    day: Number(month) * 30,
    key: `month${month}`,
    title: $t('{day} 天', { day: Number(month) * 30 }),
    label: discount > 0 ? $t('{discount}% Off', { discount }) : '',
    due: format(addDays(userPayInfo.value.subEndDate || Date.now(), Number(month) * 30), 'yyyy/MM/dd'),
  }))
  selectedDuration.value = durationList.value![0]
}

function onSelected(item: Duration) {
  selectedDuration.value = item
  emit('change', item)
}
</script>

<template>
  <div class="flex gap-3">
    <img v-if="loading" class="block mx-auto w-8 h-8 loading-circle" src="/@/assets/images/status/loading.png">
    <template v-else>
      <div v-for="(item, index) in durationList" :key="index" class="relative flex-1 py-2.5 px-3 rounded-lg select-none cursor-pointer duration" :class="{ active: selectedDuration?.key === item.key }"
           @click="onSelected(item)"
      >
        <div v-if="item.label" class="absolute top-0 right-3 py-1 px-3 rounded-full -translate-y-1/2 duration-discount">
          {{ item.label }}
        </div>
        <div class="duration-text">
          {{ item.title }}
        </div>
        <div class="mt-2 duration-desc opacity-0" :class="{ 'opacity-0': item.discount === 0 }">
          {{
            currency(durationsDiscountPrice[item.key], { symbol: '-$' }).format() }}
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.duration {
  border: 2px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &:last-child {
    .duration-discount {
      font-size: 14px;
      background: var(--primitives-red-500, #f53838);
    }
  }

  &.active {
    border: 2px solid var(--colors-border-border-brand);
    background: linear-gradient(
      180deg,
      var(--pattern-pay-gradient-selected-start, #013d65) 0%,
      var(--pattern-pay-gradient-selected-end, #293038) 100%
    );
    box-shadow: none;

    .duration-text {
      color: var(--pattern-pay-plan-text-plan-selected);
    }
  }

  &-discount {
    background: #fc9d12;
    color: #fff;
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }

  &-text {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-inactive, #a3a9ad);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;
  }
}
</style>
