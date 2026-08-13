<script setup lang="ts">
import MenuItemContent from './menu-item-content.vue'
import type { RouteRecordNameGeneric, RouteRecordRaw } from 'vue-router'
import { compare } from 'compare-versions'

defineOptions({
  name: 'SubMenuItem',
  inheritAttrs: false,
})

const { items, level = 0, collapsed, collapsedChildren } = defineProps<{
  items: RouteRecordRaw[]
  collapsed: boolean
  collapsedChildren?: boolean
  level?: number
}>()

const route = useRoute()

const collapsedMap = ref<Record<NonNullable<RouteRecordNameGeneric>, boolean>>({})
const badgeMap = defineModel<Record<NonNullable<RouteRecordNameGeneric>, boolean>>('badgeMap')

/** 是否为一级分组标题（非可跳转菜单项） */
const isGroup = (item: RouteRecordRaw) => item.meta?.type === 'group'
/** 是否为扁平分组：无标题行，子项直接铺开且不加深缩进 */
const isFlatGroup = (item: RouteRecordRaw) => item.meta?.type === 'flat'

/**
 * 仅「被传入 collapsedChildren」的节点参与折叠。
 * 根菜单不传该 prop，必须保持普通文档流高度，外层 nav 才能滚。
 */
const isCollapsible = computed(() => collapsedChildren != null)

/** 子菜单层级：分组 / 扁平分组不加深缩进 */
function getChildLevel(item: RouteRecordRaw) {
  return isGroup(item) || isFlatGroup(item) ? level : level + 1
}

/**
 * 子菜单是否折叠。
 * 扁平分组始终展开；侧栏收起时强制展开分组，避免只剩分隔线却看不到图标项。
 */
function isChildMenuCollapsed(item: RouteRecordRaw) {
  if (isFlatGroup(item) || (isGroup(item) && collapsed))
    return false

  return item.name === undefined ? false : !!collapsedMap.value[item.name]
}

/** 切换一级分组展开/收起 */
function toggleGroup(item: RouteRecordRaw) {
  if (item.name === undefined)
    return

  collapsedMap.value[item.name] = !collapsedMap.value[item.name]
}

/** 当前路由落在分组内时自动展开，避免隐藏活跃入口 */
watch(() => route.matched, (matched) => {
  for (const item of items) {
    if (!isGroup(item) || !item.name)
      continue
    const active = matched.some(m => m.name === item.name)
      || item.children?.some(child => matched.some(m => m.name === child.name))
    if (active)
      collapsedMap.value[item.name] = false
  }
}, { immediate: true })
</script>

<template>
  <!--
    滚动失效根因：overflow:hidden / height 动画不能落在 nav 的直接 flex 子项上，
    否则子项会被压到视口高，nav.scrollHeight 不再增长。
    因此根层（非 collapsible）只做普通布局；折叠动画只包在内层 clip 上。
  -->
  <div
    v-if="items.length"
    v-bind="$attrs"
    class="sub-menu-wrap"
    :class="[`level-${level}`, {
      collapsed,
      collapsible: isCollapsible,
      folded: !!collapsedChildren,
    }]"
    :style="{ '--child-count': items.length }"
  >
    <div class="sub-menu-clip">
      <div class="sub-menu">
        <template v-for="item in items" :key="item.name">
          <!-- 分组：可点击折叠，右侧 chevron 指示展开态 -->
          <template v-if="isGroup(item)">
            <button v-if="!collapsed" type="button" class="group-title" @click="toggleGroup(item)">
              <span class="group-title-text">{{ item.meta?.title }}</span>
              <SvgIcon name="base/rx_ic_chevron_up" class="group-chevron" :class="{ collapsed: collapsedMap[item.name!] }" :size="16" />
            </button>
            <div v-else class="line" />
          </template>
          <template v-else-if="!isFlatGroup(item)">
            <MenuItemContent v-if="item.meta?.version ? compare($appVersion, ...item.meta!.version) : true" v-model:open="collapsedMap[item.name!]" v-model:badge-map="badgeMap"
                             :class="`menu_${item.name?.toString()}`" :item="item" :collapsed
            />
          </template>
          <!-- 递归生成子菜单 -->
          <template v-if="item.children?.length">
            <SubMenuItem v-model:badge-map="badgeMap" :items="item.children" :level="getChildLevel(item)" :collapsed :collapsed-children="isChildMenuCollapsed(item)" />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sub-menu-wrap {
  align-self: stretch;
  // 不要 width:100%，避免撑满滚动条槽位导致滚动条表现异常

  // 可折叠层：用 grid 0fr/1fr，可中断、不写死 height，避免锁死外层滚动
  &.collapsible {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1);

    > .sub-menu-clip {
      overflow: hidden;
      min-height: 0;
      opacity: 1;
      transition: opacity 0.18s ease;
    }

    &.folded {
      grid-template-rows: 0fr;
      pointer-events: none;

      > .sub-menu-clip {
        opacity: 0;
      }
    }
  }

  &.level-1 .sub-menu {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 20px;
      width: 0.5px;
      height: 100%;
      background: var(--colors-border-border-inactive);
    }
  }

  &:last-of-type,
  &.collapsed {
    margin-bottom: 0;
  }
}

.sub-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs, 2px);
  align-self: stretch;
  padding-left: calc(32px * v-bind(level));
}

.group-title {
  display: flex;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 20px;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm, 4px);
  align-self: stretch;
  margin-top: var(--spacing-xl, 12px);
  margin-bottom: 4px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--colors-text-text-inactive, #7d8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: -0.12px;
  text-align: left;
  cursor: pointer;
  user-select: none;

  .group-title-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-chevron {
    flex-shrink: 0;
    color: currentColor;
    transition: transform 0.2s ease;

    &.collapsed {
      transform: rotate(90deg);
    }
  }

  &:hover {
    color: var(--colors-text-text-secondary, #8a9299);
  }
}

.line {
  margin: 16px auto;
  width: 20px;
  height: 1px;
  background: var(--colors-border-border-base, #c7cdd1);
}
</style>
