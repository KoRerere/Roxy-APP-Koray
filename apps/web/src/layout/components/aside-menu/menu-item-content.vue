<script setup lang="ts">
import type { RouteRecordRaw, UseLinkReturn } from 'vue-router'
import { computed, onBeforeMount, type UnwrapRef } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'

const props = defineProps<{
  item: RouteRecordRaw
  collapsed: boolean
}>()

const route = useRoute()
const isCollapsed = defineModel('open', { default: false })
const canOpen = computed(() => props.item.children?.some(n => !n.meta?.hideInMenu))

if (canOpen.value) {
  isCollapsed.value = true
}

function toggle() {
  isCollapsed.value = !isCollapsed.value
}

watchEffect(() => {
  if (route.matched.some(n => n.name === props.item.name)) {
    isCollapsed.value = false
  }
  if (props.collapsed) {
    isCollapsed.value = true
  }
})

function handleClickItem(navigate: UseLinkReturn['navigate']) {
  if (!canOpen.value || props.item.redirect) {
    navigate()
  }
}
</script>

<template>
  <div class="menu-item-content" :class="{ collapsed }">
    <RouterLink
      v-slot="{ navigate, href, isActive }"
      :to="{ name: item.name, params: item.meta?.params }"
      custom
    >
      <a
        v-ripple
        v-tooltip="{ value: item.meta?.title, disabled: !collapsed }"
        class="menu-item"
        :href="canOpen ? undefined : href"
        :class="{ active: isActive }"
        @click="handleClickItem(navigate)"
      >
        <RxSvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" />
        <div class="menu-title">
          {{ item.meta?.title }}
        </div>
        <RxSvgIcon v-if="canOpen" :name="isCollapsed ? 'base/rx_ic_plus' : 'base/rx_ic_minus'" class="menu-icon plus" @click.stop="toggle" />
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
  color: var(--Component-Colors-SideNav-link-text, #575d61);

  &:hover,
  &.active {
    color: var(--Component-Colors-SideNav-link-text-active, #0e1214);
    background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);
  }

  .menu-icon {
    width: 16px;
    height: 16px;
  }
  .menu-title {
    flex: auto;
    font-family: Inter;
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
  }
}
</style>
