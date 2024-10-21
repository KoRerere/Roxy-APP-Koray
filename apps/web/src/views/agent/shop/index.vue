<script setup lang="ts">
import RxInputNumber from '/@/components/ry-form/rx-input-number.vue'

const inputs = reactive<any>([
  {
    type: 'number',
    label: 'language',
    name: 'isLanguageBaseIp',
    placeholder: 'language',
    leftIcon: 'base/rx_ic_chrome',
    icon: 'base/rx_ic_user',
    slot: 'language',
  },
])
</script>

<template>
  <div class="h-full flex-cc">
    {{ inputs[0].value }}
    <RyForm label-position="left" :inputs="inputs">
      <template #language="{ input }">
        <RxInputNumber v-model="input.value" v-bind="input" @icon-click="() => input.iconClick?.(input, inputs)" />
      </template>
    </RyForm>
  </div>
</template>

<style scoped></style>
