<template>
  <RouterLink v-slot="{ href, navigate, isActive }" custom :to="{ name: 'agent-console-my-templates' }">
    <a
      :href="href"
      class="template-menu"
      :class="{ active: isActive }"
      @click="navigate"
    >
      <SvgIcon name="roxy-agent/rx-ic-templates" size="18" />
      <span>{{ $t('我的模板') }}</span>
    </a>
  </RouterLink>
</template>

<style lang="scss" scoped>
.template-menu {
  display: flex;
  width: 100%;
  height: 36px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
  text-decoration: none;

  &:hover,
  &.active {
    background: var(--color-bg-tertiary-hover);
  }

  &.active {
    font-weight: 500;
  }
}
</style>
