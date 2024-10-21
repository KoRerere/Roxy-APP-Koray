<script setup lang="ts">
import test from '/@/components/rx-form/demos/index.vue'
import { $t } from '/@/locales'

const inputs = reactive<any>([
  {
    type: 'radio',
    label: $t('language'),
    name: 'isLanguageBaseIp',
    value: true,
    options: [
      { label: $t('follow Ip'), value: true },
      { label: $t('custom'), value: false },
    ],
  },
])

// function handleClick() {
//   console.log('🚀 ~ handleClick ~ handleClick:')
// }
</script>

<template>
  <div class="h-full flex-cc">
    <RyForm :inputs="inputs" />
    <!-- <test /> -->
    <!-- <RyButton label="Submit" @click="handleClick" /> -->
  </div>
</template>

<style scoped></style>
