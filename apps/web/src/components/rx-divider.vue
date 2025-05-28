<script setup lang="ts">

</script>

<template>
  <div class="divider">
    <span class="mx-2">OR</span>
  </div>
</template>

<style lang="scss" scoped>
.divider {
  width: 100%;
  display: flex;
  align-items: center;
  color: var(--colors-text-text-primary, #FAFAFA);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.divider::before,
.divider::after {
  flex: 1;
  content: '';
  height: 1px;
  background: var(--colors-border-border-base, #c7cdd1);
}
</style>
