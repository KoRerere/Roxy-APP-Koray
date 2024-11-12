<script setup lang="ts">
import type { RouteRecordRaw, UseLinkReturn } from 'vue-router'
import { computed } from 'vue'
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
    <RouterLink v-slot="{ navigate, href, isActive }" :to="{ name: item.name, params: item.meta?.params, query: { title: item.meta?.title } }" custom>
      <a
        v-tooltip="{ value: $t(item.meta?.title), disabled: !collapsed }"
        class="menu-item"
        :href="canOpen ? undefined : href"
        :class="{ active: isActive }"
        @click="handleClickItem(navigate)"
      >
        <RxSvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" :size="18" />
        <div class="menu-title">
          <!-- <i18n-t :keypath="item.meta?.title" scope="global" /> -->
          {{ $t(item.meta?.title) }}
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

$delay: 0.2s;

.menu-item {
  display: flex;
  gap: var(--spacing-xl, 12px);
  color: var(--Component-Colors-SideNav-link-text, #252a2e);
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color $delay ease-in-out,
    background $delay ease-in-out;

  &:hover {
    color: var(--Component-Colors-SideNav-link-text-hover, #171c1f);
    background: var(--Component-Colors-SideNav-link-bg-hover, #f0f3f5);

    .menu-icon {
      color: var(--Component-Colors-SideNav-link-icon-hover, #7c8387);
    }
  }

  &.active {
    color: #0091eb;
    background: #d1eafa;

    .menu-icon {
      color: #0091eb;
    }
  }

  .menu-icon {
    color: var(--Component-Colors-SideNav-link-icon, #a3a9ad);
    transition: color $delay ease-in-out;
  }

  .menu-title {
    flex: auto;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-md, 16px);
    text-overflow: ellipsis;
    overflow: hidden;
  }
}
</style>
