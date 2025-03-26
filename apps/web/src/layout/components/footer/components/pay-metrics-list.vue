<script setup lang="ts">
defineProps<{
  items: {
    label: string
    usage: string
  }[]
}>()
</script>

<template>
  <template v-for="item in items" :key="item.label">
    <div class="pay-metrics-item">
      <div class="pay-metrics-item-title">
        {{ item.label }}
      </div>
      <div class="pay-metrics-item-usage">
        {{ item.usage }}
      </div>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.pay-metrics-item {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  .pay-metrics-item-title {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .pay-metrics-item-usage {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
}
</style>
