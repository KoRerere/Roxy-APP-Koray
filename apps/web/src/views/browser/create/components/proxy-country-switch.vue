<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'

const { data } = defineProps<{
  data: any
}>()

defineEmits(['close', 'confirm', 'more'])

const [_, onlyErrorToast] = useResponseToast()

const list = ref()
const selected = ref(data)

onMounted(() => {
  getList()
})

async function getList() {
  const { code, data: countryList, msg } = await API.window.userGetWindowOneClickProxyInfoListList({
    businessId: data.businessId,
    proxyProviderId: data.proxyProviderId,
  })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  list.value = countryList
}
</script>

<template>
  <div class="w-120 flex flex-col gap-4 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('选择代理 IP 国家/地区') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex items-center gap-2">
      <div v-for="item in list" :key="item.businessId" class="h-10 relative flex items-center gap-1.5 leading-none px-3 cursor-pointer select-none radio"
           :class="{ active: selected.purchaseCountry.value === item.purchaseCountry.value }" @click="selected = item"
      >
        <SvgIcon :name="(`country-code/${item.purchaseCountry.value.toLocaleUpperCase()}` as any)" size="20" />
        <div class=" tt-primary text-3.5 leading-5">
          {{ item.purchaseCountry.label }}
        </div>
      </div>

      <div class="h-10 relative flex items-center gap-1.5 leading-none px-3 cursor-pointer select-none radio" @click="$emit('more')">
        <span class="tt-primary text-3.5 leading-5">{{ $t('更多国家') }}</span>
        <SvgIcon name="base/rx_ic_arrow_right_2" color="var(--colors-icon-icon-secondary)" />
      </div>
    </div>
    <div class="mt-2 flex justify-end gap-2">
      <RxButton :label="$t('确定')" size="lg" @click="$emit('confirm', selected)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.radio {
  border-radius: 8px;
  border: 3px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  &:not(.active):hover {
    background: var(--colors-background-bg-action-hover);
  }

  &.active {
    border-color: var(--colors-border-border-brand);
    background: var(--pattern-pay-gradient-selected-start);
    box-shadow: none;

    .purpose,
    &.type_title,
    &.period {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }
}
</style>
