<script setup lang="ts">
import test from '/@/components/rx-form/demos/index.vue'
import { $t } from '/@/locales'

const inputs = reactive<any>([
  {
    type: 'radio',
    label: 'language',
    name: 'isLanguageBaseIp',
    value: '1',
    options: [
      { label: $t('some'), value: '0' },
      { label: $t('custom'), value: '1' },
      { label: $t('follow Ip'), value: '2' },
    ],
  },
])
</script>

<template>
  <div class="h-full flex-cc">
    <RyForm label-position="left" :inputs="inputs" />
  </div>
</template>

<style scoped></style>
