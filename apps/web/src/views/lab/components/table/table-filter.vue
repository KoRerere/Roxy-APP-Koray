<script setup lang="ts">
import MInputSelect from '/@/views/lab/components/form/m-input-select.vue'
import MInputMultiSelect from '/@/views/lab/components/form/m-input-multi-select.vue'
import MInputDatePicker from '/@/views/lab/components/form/m-input-date-picker.vue'
import type { Input, InputType } from '/@/views/lab/components/form/type'

interface Props {
  filters: Input[]
}

const { filters } = defineProps<Props>()

const emit = defineEmits(['change'])

const INPUT_TYPE_MAP = {
  select: MInputSelect,
  mselect: MInputMultiSelect,
  date: MInputDatePicker,
} as Partial<Record<InputType, Component>>

const INPUT_TYPE_PROPS = {
  select: {
    size: 'xxs',
  },
  mselect: {
    size: 'xxs',
    filter: false,
    showToggleAll: false,
    maxSelectedLabels: 1,
  },
  date: {
    size: 'xxs',
  },
} as Partial<Record<InputType, Record<string, any>>>

const hasChanged = ref(false)

function onUpdateModelValue() {
  hasChanged.value = true
}

function onHide() {
  if (!hasChanged.value) {
    return
  }
  hasChanged.value = false
  emit('change')
}
</script>

<template>
  <div class="flex items-center gap-2">
    <template v-for="item in filters" :key="item.name">
      <component :is="INPUT_TYPE_MAP[item.type]" v-bind="{ ...INPUT_TYPE_PROPS[item.type], ...item.props }" v-model="item.value" @update:model-value="onUpdateModelValue" @hide="onHide" />
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
