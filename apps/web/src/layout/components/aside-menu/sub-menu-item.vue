<script setup lang="ts">
import MenuItemContent from './menu-item-content.vue'
import { AnimatePresence, motion } from 'motion-v'
import type { RouteRecordNameGeneric, RouteRecordRaw } from 'vue-router'

defineOptions({
  name: 'SubMenuItem',
  inheritAttrs: false,
})

const { level = 0, collapsed, collapsedChildren } = defineProps<{
  items: RouteRecordRaw[]
  collapsed: boolean
  collapsedChildren?: boolean
  level?: number
}>()

// const d = 'max-height calc(max(calc(var(--child-count) / 3), 1) * 0.25s) cubic-bezier(0.19, 0.56, 0.03, 1.01)'

const collapsedMap = ref<Record<NonNullable<RouteRecordNameGeneric>, boolean>>({})
const badgeMap = defineModel<Record<NonNullable<RouteRecordNameGeneric>, boolean>>('badgeMap')

const isGroup = (item: RouteRecordRaw) => item.meta?.type === 'group'
</script>

<template>
  <AnimatePresence :initial="false">
    <motion.div v-if="items.length && !collapsedChildren" v-bind="$attrs" :initial="{ height: '0px', opacity: 0, y: -40 }" :animate="{ height: 'auto', opacity: 1, y: 0 }"
                :exit="{ height: '0px', opacity: 0, y: -40 }" :transition="{
                  duration: 0.6,
                  ease: [0, 0.71, 0.2, 1.01],
                  opacity: { duration: 0.3, ease: 'backOut' },
                }" class="sub-menu" :class="[`level-${level}`, { collapsed }]" :style="{ '--child-count': items.length }"
    >
      <template v-for="item in items" :key="item.name">
        <!-- 分组 -->
        <template v-if="isGroup(item)">
          <div v-if="!collapsed" class="group-title">
            <!-- <i18n-t :keypath="item.meta?.title" scope="global" /> -->
            {{ item.meta?.title }}
          </div>
          <div v-else class="line" />
        </template>
        <template v-else>
          <MenuItemContent v-model:open="collapsedMap[item.name!]" v-model:badge-map="badgeMap" :class="`menu_${item.name?.toString()}`" :item="item" :collapsed />
        </template>
        <!-- 递归生成子菜单 -->
        <template v-if="item.children?.length">
          <SubMenuItem v-model:badge-map="badgeMap" :items="item.children" :level="isGroup(item) ? level : level + 1" :collapsed :collapsed-children="collapsedMap[item.name!]" />
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
  height: 16px;
  align-items: center;
  align-self: stretch;
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-top: var(--spacing-xl, 12px);
}

.line {
  margin: 16px auto;
  width: 20px;
  height: 1px;
  background: var(--colors-border-border-base, #c7cdd1);
}
</style>
