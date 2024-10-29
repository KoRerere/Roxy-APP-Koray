<script setup lang="ts">
const visible = ref(false)

function toogle() {
  visible.value = !visible.value
}
</script>

<template>
  <RxButton @click="toogle">
    123
  </RxButton>

  <RxDrawer v-model:visible="visible" title="mannnnnnnnnnnnnnnnnnnnnn" />
</template>

<style lang="scss" scoped></style>
