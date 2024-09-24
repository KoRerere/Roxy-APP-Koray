<script setup lang="ts">
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { SimpleCache } from '/@/utils/cache'

defineProps({
  labels: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
})

const [show] = useContextMenu()
const cache = SimpleCache.getInstance()
const operation = ref()

async function openMenu(event: any) {
  await getGroups()

  show(event, {
    type: 'radio',
    operation: operation.value,
  })
}

async function getGroups() {
  const { data } = await cache.fetch(API.window.userGetLabelInfoList, { page_index: '1', page_size: '999' })
  operation.value = data.rows.map((item: any) => ({ name: item.name, label: item.name, value: `${item.id}` }))
}
</script>

<template>
  <ryButton severity="secondary" size="small" icon="base/rx_ic_stack" :label="labels[0]?.labelName" @click="openMenu" />
</template>

<style scoped></style>
