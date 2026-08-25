<script setup lang="ts">
import type { AgentNavItem } from '../types'

defineProps<{
  items: AgentNavItem[]
}>()

const emit = defineEmits<{
  select: [id: AgentNavItem['id']]
}>()

function onNavigate(event: MouseEvent, item: AgentNavItem, navigate: (event?: MouseEvent) => Promise<void> | void) {
  emit('select', item.id)
  if (item.id === 'new-chat') {
    event.preventDefault()
    return
  }

  navigate(event)
}
</script>

<template>
  <nav class="agent-nav">
    <RouterLink
      v-for="item in items"
      :key="item.id"
      v-slot="{ href, isExactActive, navigate }"
      custom
      :to="item.to"
    >
      <a
        :href="href"
        class="nav-item"
        :class="{ active: isExactActive }"
        @click="onNavigate($event, item, navigate)"
      >
        <SvgIcon :name="item.icon" size="18" />
        <span class="nav-label">{{ $t(item.label) }}</span>
        <span v-if="item.statusActive" class="nav-status-dot" aria-hidden="true" />
      </a>
    </RouterLink>
  </nav>
</template>

<style lang="scss" scoped>
.agent-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: transparent;
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary-hover);
  }

  &.active {
    background: var(--color-bg-tertiary-hover);
    font-weight: 500;
  }
}

.nav-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-left: auto;
  border-radius: 50%;
  background: #17b26a;
}
</style>
