<script setup lang="ts">
import { useTableContext } from '../hooks/useContext'

const { choose } = defineProps<{
  choose?: (option: any) => void
}>()

const { driverObj, oneClickSettings } = useTableContext()

const selected = ref()

function onChoose(option: any) {
  if (selected.value?.id === option.id)
    return

  const { windowPlatformList, ...rest } = option
  const data = {
    ...rest,
    windowPlatformList: (windowPlatformList || []).map((item: any, index: number) => ({
      ...item,
      _tempId: (Date.now() + index ** 2).toString(32),
    })),
  }
  driverObj?.value?.moveTo(2)
  selected.value = data
  choose?.(data)
}
</script>

<template>
  <div class="relative flex flex-col gap-3 pa-4 rounded-3 one-click">
    <div class="absolute top-0 right-2  py-0.5 px-2 rounded-full tag">
      {{ $t('提高 5 倍稳定性') }}
    </div>
    <div v-tooltip.top="$t('按业务一键预填指纹 + IP 用途，业务稳定性提升 5 倍，100+ 团队实测验证。')" class="cursor-pointer tt-primary text-3.5 font-700 leading-5">
      {{ $t('⚡一键配置') }}
    </div>
    <div class="flex gap-2 flex-wrap">
      <div v-for="option in oneClickSettings" :key="option.id" v-tooltip.top="{ value: option.hover, showDelay: 300 }"
           class="relative flex items-center gap-1.5 pa-1 leading-none cursor-pointer select-none radio" :class="{ active: selected?.id === option.id }" @click="onChoose(option)"
      >
        <RxImage v-if="option.image" class="block w-5" :src="option.image" :dark-src="option.darkImage" />
        <div v-else class="px-1 tt-primary text-3.5 font-500" :class="{ '!tt-brand !font-600': selected?.id === option.id }">
          {{ option.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.one-click {
  background:
    linear-gradient(180deg, rgba(182, 161, 255, 0.12) 0%, rgba(79, 124, 255, 0.12) 100%),
    var(--colors-background-bg-page, #fff);
}

.tag {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 20px;
  background: linear-gradient(90deg, #02c4ff 0%, #1cde63 100%);
}

.radio {
  border-radius: 8px;
  border: 2px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  transition: all 0.3s;

  &:not(.active):hover {
    background: var(--colors-background-bg-action-hover);
  }

  &.active {
    border-color: transparent;
    box-shadow: none;
    background:
      linear-gradient(var(--colors-background-bg-action), var(--colors-background-bg-action)) padding-box,
      linear-gradient(var(--angle), #12a3fc, #ec51f7) border-box;
    animation: 8s rotate linear infinite;
  }
}

@keyframes rotate {
  to {
    --angle: 360deg;
  }
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
</style>
