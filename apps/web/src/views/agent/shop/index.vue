<script setup lang="ts">
import InputSelectCopy from '/@/components/ry-form/input-select-copy.vue'
import { $t } from '/@/locales'

const $dict_map = new Proxy(JSON.parse(localStorage.getItem('$dict_map') ?? '{}'), {
  get(target, key) {
    return target[key] || []
  },
})

const inputs = reactive<any>([
  {
    type: 'select',
    label: 'Kernel',
    name: 'coreVersion',
    value: $dict_map.disableSslList[0],
    options: $dict_map.disableSslList,
    virtualScrollerOptions: { itemSize: 38 },
    placeholder: '请选择请选择请选择请选择请选择请选择请选择',
    optionValue: null,
    icon: 'country-code/CN',
    slot: 'test',
  },
])
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center overflow-hidden">
    <RyForm label-position="left" :inputs="inputs">
      <template #test="{ input }">
        <InputSelectCopy v-bind="input" v-model="input.value" />
      </template>
    </RyForm>
  </div>
</template>

<style scoped></style>
