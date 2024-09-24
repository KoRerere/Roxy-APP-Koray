<script lang="ts" setup>
import { API } from './api'

window.electronAPI.on('invite:to-project', async (searchStr) => {
  console.log('invite:to-project', searchStr)
  const code = new URLSearchParams(searchStr).get('data')
  if (code) {
    await API.limit.userAddUserByProjectInfoCreate(code)
  }
  else {
    console.error('invite:to-project code is null')
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
