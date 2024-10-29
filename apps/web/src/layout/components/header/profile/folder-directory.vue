<script setup lang="ts">
import type { Items } from './type'

defineOptions({
  inheritAttrs: false,
})

defineProps({
  item: {
    type: Object as PropType<Items>,
    required: true,
  },
})

const emit = defineEmits(['change'])

async function selectDir(item: Items) {
  const dirPath = await window.electronAPI.send('dialog:selectDir')
  if (dirPath) {
    item.value = dirPath
    emit('change')
  }
}
</script>

<template>
  <div class="flex gap-2">
    <InputText v-bind="$attrs" class="flex-1" type="text" />
    <RxButton outlined severity="secondary" icon="base/rx_ic_folder" @click="selectDir(item)" />
  </div>
</template>

<style scoped></style>
