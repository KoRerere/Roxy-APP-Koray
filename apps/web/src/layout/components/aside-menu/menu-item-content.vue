<script setup lang="ts">
import type { RouteRecordRaw } from 'vue-router'
import { computed, onBeforeMount } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'

const props = defineProps<{
  item: RouteRecordRaw
  collapsed: boolean
}>()

const isCollapsed = defineModel('open', { default: false })
const canOpen = computed(() => props.item.children?.some(n => !n.meta?.hideInMenu))

function toggle() {
  isCollapsed.value = !isCollapsed.value
}

onBeforeMount(() => {
  if (canOpen.value) {
    isCollapsed.value = true
  }
})
</script>

<template>
  <div class="menu-item-content" :class="{ collapsed }">
    <RouterLink
      v-slot="{ isActive, href, navigate }"
      :to="{ name: item.name }"
      custom
    >
      <a
        v-ripple
        v-tooltip="{ value: item.meta?.title, disabled: !collapsed }"
        class="menu-item"
        :href="canOpen ? undefined : href"
        :class="{ active: isActive }"
        @click="canOpen || navigate"
      >
        <RxSvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" />
        <div class="menu-title">
          {{ item.meta?.title }}
        </div>
        <RxSvgIcon v-if="canOpen" :name="isCollapsed ? 'base/rx_ic_plus' : 'base/rx_ic_minus'" class="menu-icon plus" @click="toggle" />
      </a>
    </RouterLink>
  </div>
</template>

<style lang="scss" scoped>
.menu-item-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;

  &.collapsed {
    .menu-item {
      justify-content: center;
    }
    .menu-icon.plus {
      display: none;
    }

    .menu-title {
      display: none;
    }
  }
}

.menu-item {
  display: flex;
  gap: var(--spacing-xl, 12px);
  height: 28px;
  color: var(--Component-Colors-SideNav-link-text, #575d61);
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  cursor: pointer;

  &:hover,
  &.active {
    background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);
  }

  .menu-icon {
    width: 16px;
    height: 16px;
  }
  .menu-title {
    flex: auto;
    color: var(--Component-Colors-SideNav-link-text, #575d61);
    font-family: Inter;
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
  }
}
</style>
