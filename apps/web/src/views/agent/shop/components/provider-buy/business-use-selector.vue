<script setup lang="ts">
import RxImage from '/@/components/rx-image'
import RxTooltip from '/@/components/rx-tooltip'
import type { BusinessUseOption } from './utils'

const { options, modelValue } = defineProps<{
  options: BusinessUseOption[]
  modelValue?: BusinessUseOption
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BusinessUseOption]
}>()

const styles = useCssModule()

function select(option: BusinessUseOption) {
  emit('update:modelValue', option)
}
</script>

<template>
  <div class="flex flex-col gap-2 col-span-2">
    <div class="tt-primary text-3.5 font-600 leading-normal">
      {{ $t('代理 IP 用途:') }}
    </div>
    <div class="flex gap-col-3 gap-row-4 flex-wrap">
      <template v-for="option in options" :key="option.value">
        <RxTooltip v-if="option.badgeDesc">
          <div class="flex flex-col items-center gap-0.5">
            <div
              class="h-10 relative flex items-center gap-1.5 px-4 leading-none cursor-pointer select-none"
              :class="[styles.radio, modelValue?.value === option.value ? styles.active : '']"
              @click="select(option)"
            >
              <div v-if="option.badgeDesc" class="absolute position-y-center top-0 -right-2 z-10 px-2 rounded-full" :class="styles[option.badgeClass as keyof typeof styles]">
                {{ option.badgeDesc }}
              </div>
              <RxImage v-if="option.image" class="block w-5" :src="option.image" :dark-src="option.darkImage" :alt="option.label" />
              <div :class="styles.purpose">
                {{ option.label }}
              </div>
            </div>
            <div v-if="option.isSpecialOffer" class="color-[#FF7A00] font-[DingTalk_JinBuTi] text-3.25 leading-3.5">
              {{ $t('🔥限时最低 $5.5/月') }}
            </div>
          </div>
          <template #content>
            <div class="w-76 color-[var(--component-tooltip-text-secondary)] whitespace-pre-wrap text-3 leading-4">
              {{ option.desc }}
            </div>
          </template>
        </RxTooltip>
        <div v-else class="flex flex-col items-center gap-0.5">
          <div
            class="h-10 relative flex items-center gap-1.5 px-4 leading-none cursor-pointer select-none"
            :class="[styles.radio, modelValue?.value === option.value ? styles.active : '']"
            @click="select(option)"
          >
            <RxImage v-if="option.image" class="block w-5" :src="option.image" :dark-src="option.darkImage" :alt="option.label" />
            <div :class="styles.purpose">
              {{ option.label }}
            </div>
          </div>
          <div v-if="option.isSpecialOffer" class="color-[#FF7A00] font-[DingTalk_JinBuTi] text-3.25 leading-3.5">
            {{ $t('🔥限时最低 $5.5/月') }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module>
.radio {
  border-radius: 8px;
  border: 3px solid var(--pattern-pay-plan-bg-bill);
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
  font-size: 16px;
  font-weight: 500;
}

.direct {
  color: #34393d;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #11ce46 0%, #31e163 100%);
}

.curated {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 18px;
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
}
</style>
