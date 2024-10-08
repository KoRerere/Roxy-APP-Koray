<script setup lang="tsx">
import { API } from '/@/api'
import { usePopoverMenu } from '/@/views/browser/list/profiles/components/popover-menu'

const [showMenu] = usePopoverMenu()

async function handleClick(event: any) {
  const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  const operation = data.rows.map((item: any) => ({ name: item.name, label: item.name, value: `${item.id}` }))

  // const operation = [{ name: 'a1', label: 'a1', value: '104' }, { name: 'a2', label: 'a2', value: '103' }, { name: 'a3', label: 'a3', value: '102' }, { name: 'a4', label: 'a4', value: '101' }]

  showMenu(event, {
    operation,
    afterCmp: () => (<h1>scccccccccr</h1>),
  })
}
</script>

<template>
  <div class="flex pa-50 gap-5">
    <RyButton v-for="item in 3" :key="item" @click="handleClick">
      123
    </RyButton>
  </div>
</template>

<style scoped></style>
