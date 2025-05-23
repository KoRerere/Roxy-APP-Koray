<script setup lang="ts">
import { type Plan } from '../type'
import { $t } from '/@/locales'
import { tierCalculate } from '../util'
import currency from 'currency.js';
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay.ts'

interface Column {
  key: string
  title: string
  render?: (item: Plan) => any
}

interface Props {
  data: Plan[]
}

const { data } = defineProps<Props>()

const SAMPLE = 100

const columns: Column[] = [
  { key: 'subLevel', title: $t('套餐') },
  {
    key: 'windows',
    title: $t('窗口数量'),
    render: (item: Plan) => item.minWindows >= 50000 ? '> 50000' : `${item.minWindows + 1} - ${item.maxWindows}`
  },
  {
    key: 'price',
    title: $t('区间单价'),
    render: (item: Plan) => currency(item.windowPrice).format()
  }
]

const list = computed(() => Object.values((data || []).reduce((acc, item) => {
  acc[item.subLevel] ??= { title: SubLevelEnumStr[item.subLevel as SubLevelEnum], items: [] }
  acc[item.subLevel].items.push(item)
  return acc
}, {} as Record<string, { title: string, items: Plan[] }>)))

const tierPrice = computed(() => tierCalculate(data, SAMPLE))

</script>

<template>
  <div class="flex flex-col gap-3 w-143 pa-4">
    <div>
      <div class="illustrate-title">{{ $t('窗口价格') }}</div>
      <div class="mt-2 illustrate-desc">{{ $t('窗口总价将通过各个区间的 数量×对应单价 进行累加计算') }}</div>
    </div>
    <div class="flex flex-col border-0.5 border-solid border-[#C7CDD1] rounded-md overflow-hidden">
      <div class="flex">
        <div class="flex-1 py-2 text-center bg-[#FAFBFC] cell-th" v-for="col in columns" :key="col.key">
          {{ col.title }}
        </div>
      </div>
      <div class="flex border-0 border-t-0.5 border-solid border-[#C7CDD1]" v-for="item in list" :key="item.title">
        <div class="flex justify-center items-center w-1/3 border-0 border-r-0.5 border-solid border-[#C7CDD1] cell-th">
          {{ item.title }}
        </div>
        <div class="flex-auto">
          <div class="flex gap-3 py-2 px-3 border-0 first-of-type:border-t-0 border-t-0.5 border-solid border-[#C7CDD1]"
            v-for="(it, idx) in item.items" :key="idx">
            <div class="flex-1 text-center cell-td">{{ columns[1].render?.(it) }}</div>
            <div class="flex-1 color-[#FC9D12] text-center cell-td">{{ columns[2].render?.(it) }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="illustrate-example">{{ $t('例: {count} 个窗口总价为 {algorithm}', {
      count: SAMPLE, algorithm:
        tierPrice.algorithm
    }) }}</div>
  </div>
</template>

<style scoped lang="scss">
.illustrate {
  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
  }

  &-desc {
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-family: Inter;
    font-size: 12px;
    line-height: 20px;
  }

  &-example {
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-family: Inter;
    font-size: 12px;
    line-height: 20px;
  }
}

:where(.cell-th) {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

:where(.cell-td) {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}
</style>
