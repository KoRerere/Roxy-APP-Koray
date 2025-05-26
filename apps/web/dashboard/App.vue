<script setup lang="ts">
import Dashboard from './components/dashboard.vue'
import BlobBg from '/@/components/blob-bg.vue'

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.setAttribute('data-theme', systemTheme)
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
