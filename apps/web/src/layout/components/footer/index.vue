<script setup lang="ts">
const collapsed = defineModel('collapsed', { default: false })

const list = [
  {
    text: 'Hide',
    icon: 'base/rx_ic_fold_right',
    handler() {
      collapsed.value = !collapsed.value
    },
  },
]
</script>

<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <template v-for="item in list" :key="item.text">
      <div class="item" @click="item.handler">
        <SvgIcon :name="item.icon" />
        <span v-if="!collapsed">{{ item.text }}</span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);

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
    line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
    cursor: pointer;
  }
}
</style>
