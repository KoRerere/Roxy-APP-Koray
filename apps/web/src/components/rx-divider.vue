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
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.divider::before,
.divider::after {
  flex: 1;
  content: '';
  height: 1px;
  background: var(--Colors-Border-border-container, #c7cdd1);
}
</style>
