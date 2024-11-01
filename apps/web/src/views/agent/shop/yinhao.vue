<script lang="ts" setup>
import { RxAlert } from '/@/components/rx-alert'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { $t } from '/@/locales'

const inputs: any = ref(getInputs())

function getInputs() {
  const inputs = reactive([
    {
      type: 'textarea',
      label: $t('User-Agent'),
      name: 'userAgent',
      value: '安大略可是杜拉斯的马拉松吗大阿松大',
      icon: 'base/rx_ic_shuffle',
      disabled: true,
      rows: 4,
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
