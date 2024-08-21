<script setup lang="ts">
import ryTable from '/@/components/ry-table'

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
</script>

<template>
  <div class="h-full">
    <ry-table :columns="columns" :data-list="dataList" />
  </div>
</template>

<style scoped></style>
