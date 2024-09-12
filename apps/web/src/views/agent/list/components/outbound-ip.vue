<script setup lang="ts">
import proxyIcon from '/@/assets/images/proxy.svg'

defineProps({
  image: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    default: '',
  },
  time: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="outbound">
    <img class="outbound-img" :src="image || proxyIcon">
    <div class="flex justify-between outbound-region">
      <span>{{ country || '--' }}</span>
    </div>
    <div class="flex items-center outbound-email">
      <span>{{ time }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.outbound {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
