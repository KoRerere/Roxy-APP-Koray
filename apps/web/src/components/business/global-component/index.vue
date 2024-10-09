<script setup lang="ts">
import InviteIntoWorkspace from './invite-into-workspace.vue'

onMounted(() => {
  electronAPI.send('web:ready')
  console.log('web:ready')
})
</script>

<template>
  <InviteIntoWorkspace />
</template>
