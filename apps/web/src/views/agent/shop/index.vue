<script setup lang="ts">
import { $t } from '/@/locales'

const inputs = reactive<any>([
  {
    type: 'text',
    label: 'Kernel',
    name: 'coreVersion',
    placeholder: '请选择请选择请选择请选择请选择请选择请选择',
  },
  {
    type: 'radio',
    label: $t('language'),
    name: 'isLanguageBaseIp',
    options: [
      { label: $t('follow Ip'), value: true },
      { label: $t('custom'), value: false },
    ],
  },
])

function onResize(size: any) {
  inputs.forEach((input: any) => {
    input.size = size
  })
}
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center overflow-hidden">
    <div class="flex items-end gap-4 mb-4">
      <RxButton size="xxs" label="xxs" @click="onResize('xxs')" />
      <RxButton size="xs" label="xs" @click="onResize('xs')" />
      <RxButton size="sm" label="sm" @click="onResize('sm')" />
      <RxButton size="md" label="md" @click="onResize('md')" />
      <RxButton size="lg" label="lg" @click="onResize('lg')" />
    </div>
    <RyForm label-position="left" :inputs="inputs" />
  </div>
</template>

<style scoped></style>
