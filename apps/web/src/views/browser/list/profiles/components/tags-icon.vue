<script setup lang="ts">
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { SimpleCache } from '/@/utils/cache'

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
  const { data } = await cache.fetch(API.window.userGetLabelInfoList, { page_index: '1', page_size: '999' })
  operation.value = data.rows.map((item: any) => ({ ...item, label: item.name }))
}

onMounted(() => {
  getGroups()
})
</script>

<template>
  <RxSvgIcon v-tooltip.top="{ value: 'Add tags', showDelay: 500 }" name="base/rx_ic_tag" :size="16"
    @click.stop="openMenu" />
</template>

<style scoped></style>
