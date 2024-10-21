<script setup lang="ts">
import { size } from 'es-toolkit/compat'
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

const inputs = reactive<any>([
  {
    type: 'textarea',
    label: 'language',
    name: 'isLanguageBaseIp',
    placeholder: 'language',
    leftIcon: 'base/rx_ic_chrome',
    icon: 'base/rx_ic_user',
    size: 'lg',
    slot: 'language',
  },
])
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center overflow-hidden">
    <RyForm label-position="left" :inputs="inputs">
      <template #language="{ input }">
        <RxInputTextarea v-model="input.value" v-bind="input" @icon-click="() => input.iconClick?.(input, inputs)" />
      </template>
    </RyForm>
    <!-- <div class="w-full break-words">
      {{ inputs[0].value }}
    </div> -->
  </div>
</template>

<style scoped></style>
