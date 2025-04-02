<script setup lang="ts">
import RadioButton from 'primevue/radiobutton'
import Checkbox from 'primevue/checkbox'
import type { MenuItem } from 'primevue/menuitem';
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon'

const { item, field } = defineProps<{
  item: MenuItem
  type: 'single' | 'multiple'
  field?: string
}>()

const selected = defineModel('modelValue')

const value = item[field ?? 'name']
</script>

<template>
  <a class="max-w-50 !pa-0">
    <label class="flex items-center py-2 pl-2.5 pr-2.5 gap-2 cursor-pointer w-full" :for="value">
      <RadioButton v-if="type === 'single'" v-model="selected" name="radio" :input-id="value" :value="value" />
      <Checkbox v-if="type === 'multiple'" v-model="selected" name="checkbox" :input-id="value" :value="value" />
      <slot>
        <RxSvgIcon v-if="item.icon" :name="(item.icon as SvgNames)" />
        <span class="ellipsis-1 text-[13px]" :title="(item.label as string)">{{ item.label }}</span>
      </slot>
    </label>
  </a>
</template>


<style scoped></style>