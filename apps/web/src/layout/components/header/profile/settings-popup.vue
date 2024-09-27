<script setup lang="tsx">
import { API } from '/@/api'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import type { SettingsModule } from './type'
import { getNetworkPanel, getPreferencesPanel, getProfilePanel } from './panel'

interface Active {
  key: string
  panel: SettingsModule | null
}

const active = reactive<Active>({
  key: 'Profiles',
  panel: null,
})
const profile = ref()
const preferences = ref()
const network = ref()
const menuList = ref([
  {
    label: 'Profiles',
    icon: 'base/rx_ic_user_circle',
    command: () => {
      active.key = 'Profiles'
      active.panel = profile.value
    },
  },
  {
    label: 'Preferences',
    icon: 'base/rx_ic_slider',
    command: () => {
      active.key = 'Preferences'
      active.panel = preferences.value
    },
  },
  {
    label: 'Network',
    icon: 'base/rx_ic_wifi',
    command: () => {
      active.key = 'Network'
      active.panel = network.value
    },
  },
])

async function getUserConfig() {
  const { data } = await API.base.userGetUserConfigList()
  console.log('🚀 ~ getUserConfig ~ data:', data)
  profile.value = getProfilePanel(data)
  preferences.value = getPreferencesPanel(data)
  network.value = getNetworkPanel(data)
  active.panel = profile.value
}

onBeforeMount(() => {
  getUserConfig()
})
</script>

<template>
  <div class="flex h-full">
    <div class="settings-menu">
      <div class="settings-menu-title">
        Client Settings
      </div>
      <div class="settings-menu-list">
        <div v-for="item in menuList" :key="item.label" class="settings-menu-list-item select-none cursor-pointer"
             :class="{ active: item.label === active.key }" @click="item.command"
        >
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
    <div class="settings-content">
      <div class="settings-content-wrapper">
        <div v-if="active.panel" class="w-full panel">
          <div>
            <div class="panel-title">
              {{ active.panel.title }}
            </div>
            <div class="panel-description">
              {{ active.panel.description }}
            </div>
          </div>
          <div v-for="item in active.panel.list" :key="item.subtitle">
            <div v-if="item.subtitle" class="mb-3">
              {{ item.subtitle }}
            </div>
            <div v-for="subItem in item.items" :key="subItem.label" class="panel-item" :class="subItem.classes">
              <div class="flex-1">
                <div class="panel-item-label">
                  {{ subItem.label }}
                </div>
                <div class="panel-item-text" v-html="subItem.text" />
              </div>
              <div class="flex-1 flex justify-end w-full">
                <component :is="subItem.component" v-bind="subItem.props" v-model="subItem.value"
                           class="panel-item-value"
                />
              </div>
            </div>
          </div>
        </div>
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

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--oversize-spacing-3rem, 48px);

  &-title {
    color: #000;
    font-size: 18px;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
  }

  &-description {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-size: 12px;
    line-height: normal;
  }

  &-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-2xl, 16px) 0px;
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

    &-label {
      color: #000;
      font-size: 12px;
      font-weight: 500;
      line-height: normal;
    }

    &-text {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-size: 10px;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &-value {
      color: #000;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>
