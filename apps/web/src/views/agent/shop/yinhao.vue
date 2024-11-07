<script lang="ts" setup>
import { format } from 'date-fns'
import { RxAlert } from '/@/components/rx-alert'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { $t } from '/@/locales'

const input = ref(
  {
    type: 'date',
    name: 'modfiyTime',
    label: $t('修改时间'),
    selectionMode: 'range',
    manualInput: false,
    showButtonBar: false,
    dateFormat: 'yy/mm/dd',
  },
)
</script>

<template>
  <div class="flex gap-6 p-10 flex-col">
    <RyForm :inputs="[input] as any" />

    <RxAlert type="success" title="标题" content="内容" />
    <RxAlert type="error" title="标题" content="内容" />
  </div>
</template>
