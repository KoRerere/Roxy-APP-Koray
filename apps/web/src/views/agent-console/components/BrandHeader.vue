<template>
  <div class="brand-header">
    <span class="brand-mark" aria-hidden="true">
      <SvgIcon name="roxy-agent/rx-ic-logo" size="32" />
    </span>
    <div class="brand-copy">
      <div class="brand-title">Roxy AI Agent</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.brand-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  min-width: 0;
}

.brand-mark {
  display: grid;
  position: relative;
  width: 32px;
  height: 32px;
  place-items: center;
  flex: 0 0 32px;
  border-radius: 999px;
  background: var(--agent-gradient);
  overflow: hidden;

  :deep(.svg) {
    position: relative;
    z-index: 1;
    display: block;
    width: 32px;
    height: 32px;
  }
}

.brand-copy {
  min-width: 0;
}

.brand-title {
  color: var(--color-text-primary);
  font-family: Archivo, Inter, sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
}
</style>
