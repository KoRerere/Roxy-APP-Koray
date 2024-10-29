<script setup lang="ts">
import { $t } from '/@/locales'

const filters = reactive({
  value: null,
  options: [
    {
      name: $t('全部'),
      value: null,
    },
    {
      name: $t('已启用'),
      value: true,
    },
    {
      name: $t('未启用'),
      value: false,
    },
  ],
  onChange() {
  },
  resetFilters() {
    filters.value = null
    filters.onChange()
  },
})
</script>

<template>
  <div class="w-full h-full flex justify-center items-center">
    <RxSelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
  </div>
</template>

<style scoped></style>
