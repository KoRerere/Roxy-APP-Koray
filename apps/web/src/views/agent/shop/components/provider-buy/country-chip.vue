<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import type { CountryOption } from './utils'

const { option, active } = defineProps<{
  option: CountryOption
  active: boolean
}>()

const emit = defineEmits<{ select: [option: CountryOption] }>()
const styles = useCssModule()
</script>

<template>
  <div class="w-38 h-10 relative flex items-center justify-center gap-1.5 leading-none cursor-pointer select-none" :class="[styles.radio, active ? styles.active : '']" @click="emit('select', option)">
    <div v-if="option.isNew"
         class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white"
    >
      NEW
    </div>
    <div v-if="option.isHot"
         class="pointer-events-none absolute top-0 right-0 z-10 -translate-y-2/3 translate-x-2/5 rounded-full bg-[#f53838] font-[DingTalk_JinBuTi] px-1.5 text-2.5 font-bold leading-normal whitespace-nowrap text-white"
    >
      HOT
    </div>
    <RxSvgIcon :name="(option.icon as any)" size="18" />
    <div :class="styles.purpose">
      {{ option.name }}
    </div>
  </div>
</template>

<style lang="scss" module>
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

    .purpose {
      color: var(--colors-text-text-brand);
      font-weight: 600;
    }
  }
}

.purpose {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
}
</style>
