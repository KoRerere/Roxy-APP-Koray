<script setup lang="ts">

</script>

<template>
  <div class="app-update-block">
    <div class="app-update-block__title">
      {{ $t('Roxy is ready to update!') }}
    </div>
    <div class="app-update-block__description">
      {{ $t('Click to restart') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-update-block {
  display: flex;
  padding: var(--spacing-3xl, 20px) 0px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);

  .app-update-block__title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .app-update-block__description {
    color: var(--Colors-Alpha-alpha-black-40, rgba(0, 0, 0, 0.4));
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
}
</style>
