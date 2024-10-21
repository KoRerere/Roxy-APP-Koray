<script setup lang="ts">
import RxInputText from '/@/components/ry-form/rx-input-text.vue'

const inputs = reactive<any>([
  {
    type: 'text',
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
  <div class="h-full flex-cc">
    {{ inputs[0].value }}
    <RyForm label-position="left" :inputs="inputs">
      <template #language="{ input }">
        <RxInputText v-model="input.value" v-bind="input" @icon-click="() => input.iconClick?.(input, inputs)" />
      </template>
    </RyForm>
  </div>
</template>

<style scoped></style>
