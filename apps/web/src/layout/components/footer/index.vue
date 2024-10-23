<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import LiveChat from '/@/components/business/live-chat/index.vue'
import { $t } from '/@/locales'

const collapsed = defineModel('collapsed', { default: false })

const list = ref([
  {
    text: $t('Get support'),
    icon: 'base/rx_ic_headphone_2',
    component: markRaw(LiveChat),
  },
  {
    text: $t('Hide'),
    icon: 'base/rx_ic_fold_right',
    iconAttr: computed(() => {
      return {
        class: { 'rotate-180': collapsed.value },
      }
    }),
    itemClass: 'mt-[16px]',
    handler() {
      collapsed.value = !collapsed.value
    },
  },
])
</script>

<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <template v-for="item in list" :key="item.text">
      <component :is="item.component || 'div'" class="item" :class="item.itemClass" @click="item.handler">
        <SvgIcon v-bind="item.iconAttr" :name="(item.icon as SvgNames)" />
        <span v-if="!collapsed">{{ item.text }}</span>
      </component>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  white-space: nowrap;
  word-break: keep-all;
  overflow: hidden;

  &.collapsed {
    .item {
      justify-items: center;
    }
  }

  .item {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    gap: var(--spacing-xl, 12px);
    flex: 1 0 0;
    color: var(--Component-Colors-SideNav-link-text, #575d61);
    font-family: Inter;
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    min-height: var(--Line-Height-text-lg, 20px);
    line-height: var(--Line-Height-text-lg, 20px);
    /* 153.846% */
    cursor: pointer;
  }
}
</style>
