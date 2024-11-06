<script lang="ts" setup>
import { RxAlert } from '/@/components/rx-alert'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { $t } from '/@/locales'

const inputs: any = ref(getInputs())

function getInputs() {
  const inputs = reactive([
    {
      type: 'date',
      name: 'modfiyTime',
      label: $t('修改时间'),
      placeholder: $t('请选择修改时间'),
      selectionMode: 'range',
      manualInput: false,
      showButtonBar: false,
      dateFormat: 'yy/mm/dd',
    },
  ])
  return inputs
}
</script>

<template>
  <div class="flex gap-6 p-10 flex-col">
    <RyForm :inputs="inputs" />

    <RxAlert type="success" title="标题" content="内容" />
    <RxAlert type="error" title="标题" content="内容" />
  </div>
</template>
