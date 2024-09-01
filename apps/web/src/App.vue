<script lang="ts" setup>

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
</style>
