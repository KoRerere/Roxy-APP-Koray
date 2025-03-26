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
  background: var(--Colors-Alpha-alpha-white-60, rgba(255, 255, 255, 0.6));
}
</style>
