<script setup lang="ts">
import { h } from 'vue'
import { SearchOutlined } from '@ant-design/icons-vue'
</script>

<template>
  <a-button type="primary" :icon="h(SearchOutlined)">
    Search
  </a-button>
</template>

<style scoped></style>
