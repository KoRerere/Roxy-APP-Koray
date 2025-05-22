<script setup lang="ts">

</script>

<template>
  <div class="pay-metrics-card">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.pay-metrics-card {
  display: flex;
  padding: 10px;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  background: var(--pattern-sidenav-metrics, rgba(255, 255, 255, 0.05));
}
</style>
