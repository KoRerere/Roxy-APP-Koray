<script lang="ts" setup>
window.electronAPI.on('invite:to-project', (searchStr) => {
  console.log('invite:to-project', searchStr)
  const code = new URLSearchParams(searchStr).get('data')
  if (code) {}
  else {
    console.error('google oauth2 code is null')
  }
})
</script>

<template>
  <RouterView />
  <Toast />
  <Toast position="top-center" group="tc" />
  <ConfirmDialog :pt="{ root: 'rx-dialog' }" />
  <DynamicDialog />
</template>

<style lang="scss">
.rx-dialog {
  min-width: 350px;
}

.p-tooltip-arrow {
  display: none;
}
</style>
