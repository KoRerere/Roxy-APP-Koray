<script setup lang="ts">
import Fuse from 'fuse.js'
import RxLoading from '/@/components/rx-loading.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import CountryChip from './country-chip.vue'
import { groupCountryOptionsByContinent } from './utils'
import type { CountryOption } from './utils'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'

const { options, modelValue, loading } = defineProps<{
  options: CountryOption[]
  modelValue?: CountryOption
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CountryOption]
}>()

const labels = useProxyPurchaseLabels()

const searchCountry = ref('')

const groupedList = computed(() => groupCountryOptionsByContinent(options))

const searchResults = computed(() => {
  const keyword = searchCountry.value.trim()
  if (!keyword) {
    return []
  }
  const fuse = new Fuse(options, {
    keys: [
      { name: 'country_name', weight: 2 },
      { name: 'country_code', weight: 1 },
      { name: 'continent_name', weight: 0.5 },
    ],
    threshold: 0.3,
  })
  return fuse.search(keyword).map(item => item.item)
})

function select(option: CountryOption) {
  emit('update:modelValue', option)
}
</script>

<template>
  <div class="flex flex-col gap-4 col-span-2">
    <div class="flex gap-2 items-center">
      <div class="shrink-0 w-22 tt-primary text-3.5 font-600 leading-normal whitespace-nowrap">
        {{ labels.selectCountry }}
      </div>
      <TsFormInputText :model-value="searchCountry" :placeholder="$t('搜索国家/地区名称或代码')" class="!w-50" pre-icon="base/rx_ic_magnify" @update:model-value="searchCountry = $event" />
    </div>

    <div v-if="searchCountry.trim()" class="relative min-h-20 flex gap-3 flex-wrap pl-23.5">
      <template v-if="searchResults.length">
        <CountryChip v-for="option in searchResults" :key="option.value" :option="option" :active="modelValue?.value === option.value" @select="select" />
      </template>
      <div v-else class="relative flex items-center flex-col justify-center gap-2.5 py-12 bg-[var(--colors-background-bg-block)] rounded-2 w-full">
        <SvgIcon name="base/rx_ic_earth" :size="32" color="var(--colors-icon-icon-inactive)" />
        <div class="text-[var(--colors-text-text-inactive)] text-3">
          {{ $t('抱歉，没有找到匹配结果。') }}
        </div>
      </div>
    </div>

    <div v-else class="relative min-h-20">
      <RxLoading :model-value="loading" :opacity="0.9" />
      <div class="flex flex-col gap-3">
        <div v-for="group in groupedList" :key="group.title" class="flex gap-2">
          <div class="w-22 h-10 flex items-center tt-tertiary text-3.5 font-500 leading-5 shrink-0">
            {{ group.title }}:
          </div>
          <div class="flex gap-3 flex-wrap">
            <CountryChip v-for="option in group.items" :key="option.value" :option="option" :active="modelValue?.value === option.value" @select="select" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
