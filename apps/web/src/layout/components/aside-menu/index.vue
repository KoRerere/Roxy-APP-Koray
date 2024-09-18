<script setup lang=ts>
import SubMenuItem from './sub-menu-item.vue'
import { menuRoutes } from '/@/router/menu'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()

function toCreateBrowser() {
  router.push({ name: 'browser-create' })
}
</script>

<template>
  <aside class="aside" :class="{ collapsed }">
    <ry-button :label="collapsed ? '' : 'New profile'" icon="base/rx_ic_browser_add" class="new-profile-btn" @click="toCreateBrowser" />
    <nav class="menu">
      <SubMenuItem :items="menuRoutes" :collapsed />
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.aside {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  flex: 1 0 0;
  align-self: stretch;
  white-space: nowrap;
  word-break: keep-all;
  isolation: isolate;

  .menu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
  }

  &.collapsed {
    .new-profile-btn {
      margin-left: -3px;
    }
  }
}
</style>
