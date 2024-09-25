<script setup lang="ts">
import Network from './network.vue'
import Preferences from './preferences.vue'
import Profile from './profile.vue'

import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

const list = [
  {
    label: 'Profiles',
    icon: 'base/rx_ic_user_circle',
    command: () => {
      // router.push({ name: 'profile' })
    },
  },
  {
    label: 'Preferences',
    icon: 'base/rx_ic_slider',
  },
  {
    label: 'Network',
    icon: 'base/rx_ic_wifi',
  },
]

const active = ref('Preferences')
</script>

<template>
  <div class="flex h-full">
    <div class="settings-menu">
      <div class="settings-menu-title">
        Client Settings
      </div>
      <div class="settings-menu-list">
        <div v-for="item in list" :key="item.label" class="settings-menu-list-item select-none cursor-pointer"
          :class="{ active: item.label === active }" @click="active = item.label">
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
    <div class="settings-content">
      <div class="settings-content-wrapper">
        <Profile v-show="active === 'Profiles'" />
        <Preferences v-show="active === 'Preferences'" />
        <Network v-show="active === 'Network'" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings {
  &-menu {
    display: flex;
    width: 246px;
    height: 640px;
    padding: var(--spacing-4xl, 24px) 0px 0px var(--spacing-4xl, 24px);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-4xl, 24px);
    flex-shrink: 0;

    &-title {
      color: #000;
      font-size: 14px;
      font-weight: 600;
      line-height: 16px;
    }

    &-list {
      display: flex;
      flex-direction: column;
      padding: 0px var(--spacing-3xl, 20px);
      gap: var(--spacing-xs, 2px);
      width: 100%;

      &-item {
        display: flex;
        align-items: center;
        padding: 4px 6px;
        gap: var(--spacing-xl, 12px);
        color: var(--Component-Colors-SideNav-link-text, #575d61);
        font-size: var(--Font-Size-text-md, 13px);
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px);
        border-radius: 4px;

        &:hover {
          background: var(--Component-Colors-SideNav-link-bg-active, #f2f3f5);
        }

        &.active {
          background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);
        }
      }
    }
  }

  &-content {
    padding-right: 24px;
    width: 100%;
    overflow-y: auto;

    &-wrapper {
      margin: 0 auto;
      padding-top: 24px;
      width: calc(100% / 3 * 2);
    }
  }
}
</style>
