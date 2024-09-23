<script setup lang="ts">
import type { RouteRecordNameGeneric, RouteRecordRaw } from 'vue-router'
import MenuItemContent from './menu-item-content.vue'

defineOptions({
  name: 'SubMenuItem',
})

const { level = 0, collapsed } = defineProps<{
  items: RouteRecordRaw[]
  collapsed: boolean
  level?: number
}>()

const collapsedMap = ref<Record<NonNullable<RouteRecordNameGeneric>, boolean>>({})

const isGroup = (item: RouteRecordRaw) => item.meta?.type === 'group'
</script>

<template>
  <div v-if="items.length" class="sub-menu">
    <template v-for="item in items.filter(n => !n.meta?.hideInMenu)" :key="item.name">
      <!-- 分组 -->
      <template v-if="isGroup(item)">
        <div v-if="!collapsed" class="group-title">
          {{ item.meta?.title }}
        </div>
        <div v-else class="line" />
      </template>
      <template v-else>
        <MenuItemContent v-model:open="collapsedMap[item.name!]" :item="item" :collapsed />
      </template>
      <!-- 递归生成子菜单 -->
      <template v-if="item.children?.length">
        <SubMenuItem
          :items="item.children.filter(n => !n.meta?.hideInMenu)"
          :level="isGroup(item) ? level : level + 1" :collapsed
          :class="{ collapsedChildren: collapsedMap[item.name!] }"
        />
      </template>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.sub-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  overflow: hidden;
  transition: height 0.3s;
  padding-left: calc(26px * v-bind(level));

  &.collapsedChildren {
    height: calc-size(auto);
    height: 0;
  }
}

.group-title {
  display: flex;
  height: 12px;
  align-items: center;
  align-self: stretch;
  color: rgba(4, 33, 68, 0.3);
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
}

.line {
  width: 100%;
  height: 1px;
  background: var(--Colors-Border-border-container, #c7cdd1);
}
</style>
