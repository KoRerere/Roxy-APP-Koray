<script setup lang="ts">
import { computed } from 'vue'
import type { RouteRecordRaw, UseLinkReturn } from 'vue-router'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon'

const props = defineProps<{
  item: RouteRecordRaw
  collapsed: boolean
}>()

const cacheKey = 'isShowBuyProxyNewBadge'
const isShowNewBadge = ref(!localStorage.getItem(cacheKey))

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

function handleClickItem(event: Event, navigate: UseLinkReturn['navigate']) {
  if (props.item.meta?.type === 'button') {
    props.item.meta?.onClick?.(event)
  }
  else if (!canOpen.value || props.item.redirect) {
    navigate()
  }

  if (props.item.meta?.newBadge) {
    localStorage.setItem(cacheKey, 'true')
    isShowNewBadge.value = false
  }
}
</script>

<template>
  <div class="menu-item-content" :class="{ collapsed }">
    <RouterLink v-slot="{ navigate, href, isActive }" :to="{ name: item.name, params: item.meta?.params, query: { title: item.meta?.title } }" custom>
      <a v-ripple v-tooltip="{ value: item.meta?.title, disabled: !collapsed }" class="menu-item" :href="canOpen || item.meta?.type === 'button' ? undefined : href" :class="{ active: isActive }"
        @click="handleClickItem($event, navigate)">
        <RxSvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" :size="18" />
        <div class="menu-title" :title="item.meta?.title">
          <span>{{ item.meta?.title }}</span>
        </div>
        <SvgIcon v-if="item.meta?.newBadge && isShowNewBadge" class="new-badge" size="25" :name="(item.meta?.newBadge as SvgNames)" />
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
  z-index: 1;

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
  color: #575D61;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  cursor: pointer;
  color: var(--colors-text-text-primary, #FAFAFA);
  transition: all 0.15s ease-in-out;

  .menu-title {
    position: relative;
    flex: auto;
    font-size: 14px;
    font-weight: 500;
    line-height: 16px;
    text-overflow: ellipsis;
    overflow: hidden;
    line-height: 20px;
  }


  &:hover {
    color: var(--colors-text-text-primary-hover, #FFF);
    background: var(--pattern-sidenav-bg-hover, rgba(255, 255, 255, 0.05));
  }

  &.active {
    color: var(--pattern-sidenav-text-active, #3FB6FD);
    background: var(--pattern-sidenav-bg-active, #013D65);
    font-weight: bold;

    .menu-title {
      font-weight: bold;
      color: currentColor;
    }
  }

  .menu-icon {
    color: currentColor;
  }


}

.new-badge {
  position: absolute;
  margin-left: 6px;
  top: 0;
  right: 3px;
}
</style>
