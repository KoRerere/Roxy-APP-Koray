<script setup lang="ts">
import ryTable from '/@/components/ry-table'
import ryContextMenu from '/@/components/ry-contextMenu'

const columns = ref([
  {
    title: '状态',
    key: 'status',
  },
  {
    title: '链接1',
    key: 'link',
  },
])

const dataList = ref(Array.from({ length: 20 }, (_, index) => ({ id: index, status: '正常', link: 'https://www.baidu.com' })))

const textMenu = ref()

onMounted(() => {
  textMenu.value.getRef()
})
</script>

<template>
  <ry-contextMenu ref="textMenu" />
  <div class="h-full">
    <ry-table :columns="columns" :data-list="dataList" />
  </div>
</template>

<style scoped></style>
