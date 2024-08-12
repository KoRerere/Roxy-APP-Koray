<script setup lang="ts">
import { ref } from 'vue'
const currentPage = ref(1)
const pageSize = ref(10)

</script>

<template>
  <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      size="small"
      layout="total, sizes, jumper, prev, pager, next"
      :total="300"
      v-bind="$attrs"
    />
</template>



<style scoped>

</style>