<script setup lang="tsx">
import type { SvgNames } from '/@/components/rx-icon'
import LiveChat from '/@/components/business/live-chat/index.vue'
import { $t } from '/@/locales'
import { RouterLink } from 'vue-router'
import Help from './components/help.vue'

const collapsed = defineModel('collapsed', { default: false })
const router = useRouter()

const list = [
  {
    text: $t('推广计划'),
    icon: 'base/rc_ic_user_referral',
    component: (props, { slots }) => <RouterLink {...props} to={{ name: 'referral-program' }} custom>
      {{ default: ({ navigate, isActive }) => <div class={{ active: isActive }} onClick={navigate}>{slots.default?.()}</div> }}
    </RouterLink>,
  },
  {
    text: $t('联系支持人员'),
    icon: 'base/rx_ic_headphone_2',
    component: Help,
  },
  {
    text: $t('收起'),
    icon: 'base/rx_ic_fold_right',
    get iconAttr() {
      return {
        class: { 'rotate-180': collapsed.value },
      }
    },
    handler() {
      collapsed.value = !collapsed.value
    },
  },
]
</script>

<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <template v-for="item in list" :key="item.text">
      <component :is="item.component || 'div'" class="item" @click="item.handler">
        <SvgIcon class="item-icon" v-bind="item.iconAttr" :name="(item.icon as SvgNames)" />
        <span v-if="!collapsed">{{ item.text }}</span>
      </component>
    </template>
  </div>
</template>

<style lang="scss">
.rx-layout-footer {
  width: 100%;
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
    width: 100%;
    display: flex;
    align-items: center;
    padding: var(--spacing-md, 6px) 8px;
    gap: var(--spacing-xl, 12px);
    flex: 1 0 0;
    color: var(--Component-Colors-SideNav-link-text, #252a2e);
    font-family: Inter;
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);
    cursor: pointer;
    border-radius: 4px;

    &-icon {
      color: var(--Component-Colors-SideNav-link-icon, #a3a9ad);
    }

    &.active {
      color: var(--Component-Colors-SideNav-link-text-active, #0e1214);
      background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);

      .menu-icon {
        color: currentColor;
      }
    }
  }
}
</style>
