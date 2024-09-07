<script setup lang="ts">
import { SimpleCache } from '/@/utils/cache'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'

const [show] = useContextMenu()
const cache = SimpleCache.getInstance()
const operation = ref()

function operationHandler(operate: any) {
  console.log('🚀 ~ operationHandler ~ operate:', operate)
}

function openMenu(event: any) {
  show(event, {
    operation: operation.value,
    operationHandler,
  })
}

async function getGroups() {
  const { data } = await cache.fetch(API.window.userGetGroupInfoList, { page_index: 1, page_size: 999 })
  operation.value = data.rows.map((item: any) => ({ ...item, label: item.name }))
}

onMounted(() => {
  getGroups()
})
</script>

<template>
  <span v-tooltip.top="{ value: 'Add group', showDelay: 500 }" class="mdi mdi-shape-outline" @click.stop="openMenu" />
</template>

<style scoped></style>
