<script setup lang="ts">
import MenuItemContent from './menu-item-content.vue'
import { AnimatePresence, motion } from 'motion-v'
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
// const d = 'max-height calc(max(calc(var(--child-count) / 3), 1) * 0.25s) cubic-bezier(0.19, 0.56, 0.03, 1.01)'

const collapsedMap = ref<Record<NonNullable<RouteRecordNameGeneric>, boolean>>({})
const badgeMap = defineModel<Record<NonNullable<RouteRecordNameGeneric>, boolean>>('badgeMap')

const isGroup = (item: RouteRecordRaw) => item.meta?.type === 'group'
const isFlatGroup = (item: RouteRecordRaw) => item.meta?.type === 'flat'

function toggleGroup(item: RouteRecordRaw) {
  if (item.name === undefined)
    return

  collapsedMap.value[item.name] = !collapsedMap.value[item.name]
}

function getChildLevel(item: RouteRecordRaw) {
  return isGroup(item) || isFlatGroup(item) ? level : level + 1
}

function isChildMenuCollapsed(item: RouteRecordRaw) {
  if (isFlatGroup(item) || (isGroup(item) && collapsed))
    return false

  return item.name === undefined ? false : collapsedMap.value[item.name]
}

watchEffect(() => {
  for (const item of items) {
    if (isGroup(item) && item.name !== undefined && route.matched.some(routeItem => routeItem.name === item.name)) {
      collapsedMap.value[item.name] = false
    }
  }
})
</script>

<template>
  <AnimatePresence :initial="false">
    <motion.div v-if="items.length && !collapsedChildren" v-bind="$attrs" :initial="{ height: '0px', opacity: 0 }" :animate="{ height: 'auto', opacity: 1 }"
                :exit="{ height: '0px', opacity: 0 }" :transition="{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  opacity: { duration: 0.15, ease: 'easeOut' },
                }" class="sub-menu" :class="[`level-${level}`, { collapsed }]" :style="{ '--child-count': items.length }"
    >
      <template v-for="item in items" :key="item.name">
        <!-- 分组 -->
        <template v-if="isGroup(item)">
          <button v-if="!collapsed" type="button" class="group-title" @click="toggleGroup(item)">
            <span>{{ item.meta?.title }}</span>
            <SvgIcon name="base/rx_ic_chevron_up" class="group-chevron" :class="{ collapsed: collapsedMap[item.name!] }" :size="16" />
          </button>
          <div v-else class="line" />
        </template>
        <template v-else-if="!isFlatGroup(item)">
          <MenuItemContent v-if="item.meta?.version ? compare($appVersion, ...item.meta!.version) : true" v-model:open="collapsedMap[item.name!]" v-model:badge-map="badgeMap" :class="`menu_${item.name?.toString()}`" :item="item" :collapsed />
        </template>
        <!-- 递归生成子菜单 -->
        <template v-if="item.children?.length">
          <SubMenuItem v-model:badge-map="badgeMap" :items="item.children" :level="getChildLevel(item)" :collapsed :collapsed-children="isChildMenuCollapsed(item)" />
        </template>
      </template>
    </motion.div>
  </AnimatePresence>
</template>

<style lang="scss" scoped>
@use 'sass:string';

.sub-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs, 2px);
  align-self: stretch;
  padding-left: calc(32px * v-bind(level));

  &.level-1 {
  overflow: hidden;
  }

  &:last-of-type,
  &.collapsed {
    margin-bottom: 0;
  }

  &.level-1::before {
    content: '';
    position: absolute;
    left: 20px;
    width: 0.5px;
    height: 100%;
    background: var(--colors-border-border-inactive);
  }
}

.group-title {
  display: flex;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 20px;
  align-items: center;
  justify-content: space-between;
  align-self: stretch;
  margin-top: 10px;
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

  .group-chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;

    &.collapsed {
      transform: rotate(90deg);
    }
  }
}

.line {
  margin: 16px auto;
  width: 20px;
  height: 1px;
  background: var(--colors-border-border-base, #c7cdd1);
}
</style>
