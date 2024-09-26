<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { API } from './api'

const toast = useToast()

window.electronAPI.on('invite:to-project', async (searchStr) => {
  console.log('invite:to-project', searchStr)
  // URLSearchParams 会把 + 号转成空格，所以这里不用 URLSearchParams
  // const code = new URLSearchParams(searchStr).get('data')
  const inviteCode = searchStr.split('data=')[1]
  if (inviteCode) {
    console.log('invite:to-project code', inviteCode)
    const { code, msg } = await API.limit.userAddUserByProjectInfoCreate(inviteCode)
    if (code === 0) {
      toast.add({ severity: 'success', summary: 'Success', detail: 'Invite success', life: 3000 })
    }
    else {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
    }
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
