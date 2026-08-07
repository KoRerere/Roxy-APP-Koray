<script setup lang="ts">
const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <section class="custom-template-banner">
    <div>
      <h2>{{ $t('没有找到合适的模板？') }}</h2>
      <p>{{ $t('联系 Roxy自动化专家，为您量身定制模板。') }}</p>
    </div>
    <button type="button" @click="emit('open')">{{ $t('扫码开始定制') }}</button>
  </section>
</template>

<style lang="scss" scoped>
.custom-template-banner {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 81px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-radius: 10px;
  background-color: var(--color-bg-primary);
  background-image: var(--agent-gradient-soft);
  overflow: hidden;

  > div {
    min-width: 0;
    flex: 1;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  p {
    margin-top: 5px;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }

  button {
    box-sizing: border-box;
    display: inline-flex;
    height: 32px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border: 0;
    border-radius: 10px;
    color: var(--agent-gradient-foreground);
    background: var(--agent-gradient);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    white-space: nowrap;

    &:hover {
      filter: saturate(1.08) brightness(0.98);
    }

    &:focus-visible {
      outline: 2px solid var(--color-text-primary);
      outline-offset: 2px;
    }
  }
}

@media (max-width: 680px) {
  .custom-template-banner {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;

    button {
      width: 100%;
    }
  }
}
</style>
