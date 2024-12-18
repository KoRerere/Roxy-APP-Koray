<script setup lang="ts">
import Dashboard from './components/dashboard.vue'
import BlobBg from '/@/components/blob-bg.vue'
</script>

<template>
  <Toast />
  <Dashboard />
  <BlobBg />
</template>

<style>
body {
  overflow: auto;
}
</style>
