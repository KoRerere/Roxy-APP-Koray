<script setup lang="ts">
import type { RouteRecordRaw, UseLinkReturn } from 'vue-router'
import { computed } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'

const props = defineProps<{
  item: RouteRecordRaw
  collapsed: boolean
}>()

const cacheKey = 'isShowSyncControlNewBadge'

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

function handleClickItem(navigate: UseLinkReturn['navigate']) {
  if (props.item.meta?.type === 'button') {
    props.item.meta?.onClick?.()
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
    <RouterLink v-slot="{ navigate, href, isActive }"
      :to="{ name: item.name, params: item.meta?.params, query: { title: item.meta?.title } }" custom>
      <a v-ripple v-tooltip="{ value: item.meta?.title, disabled: !collapsed }" class="menu-item"
        :href="canOpen || item.meta?.type === 'button' ? undefined : href" :class="{ active: isActive }"
        @click="handleClickItem(navigate)">
        <RxSvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" :size="18" />
        <div class="menu-title">
          <!-- <i18n-t :keypath="item.meta?.title" scope="global" /> -->
          {{ item.meta?.title }}
          <RxSvgIcon v-if="item.meta?.newBadge && isShowNewBadge" :name="item.meta?.newBadge" size="24px"
            class="new-badge" />
        </div>
        <RxSvgIcon v-if="canOpen" :name="isCollapsed ? 'base/rx_ic_plus' : 'base/rx_ic_minus'" class="menu-icon plus"
          @click.stop="toggle" />
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
  color: #575D61;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  .menu-title {
    position: relative;
    flex: auto;
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    font-style: normal;
    line-height: var(--Line-Height-text-md, 16px);
    text-overflow: ellipsis;
    overflow: hidden;
    line-height: 20px;
    color: var(--Component-Colors-SideNav-link-text, #252A2E);
  }


  &:hover {
    color: var(--Component-Colors-SideNav-link-text-hover, #171c1f);
    background: var(--Component-Colors-SideNav-link-bg-hover, #f0f3f5);
  }

  &.active {
    color: #0085EB;
    background: #D6ECFA;
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
  top: -3px;
}
</style>
