<script setup lang="ts">
import { isFunction } from 'es-toolkit'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon/'
import type { SvgNames } from '/@/components/rx-icon/'

import { useSettingsPopup } from './settings-popup/'
import { TaskbarImagePreviewHost } from './settings-popup/usePreferences'

const { dialogRef, activePanel, panels, initPanels } = useSettingsPopup()

function closePopup() {
  dialogRef?.value.close()
}

onBeforeMount(async () => {
  activePanel.key = dialogRef?.value?.data?.props?.activeKey
  await initPanels()
  nextTick(() => {
    const anchorPoint = dialogRef?.value?.data?.props?.anchorPoint
    if (anchorPoint) {
      document.getElementById(anchorPoint)?.scrollIntoView({ behavior: 'smooth' })
    }
  })
})
</script>

<template>
  <div class="flex h-full relative">
    <div class="settings-menu">
      <div class="settings-menu-title">
        <span>{{ $t('客户端设置') }}</span>
      </div>
      <div class="settings-menu-list">
        <div v-for="item in panels" :key="item.name" class="settings-menu-list-item select-none cursor-pointer" :class="{ active: item.name === activePanel.key }" @click="item.command">
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span>{{ item.label }}</span>
        </div>
      </div>
      <RxButton icon="base/rx_ic_delete" text severity="secondary" size="lg" class="close-btn" @click="closePopup" />
    </div>
    <div class="settings-content">
      <div class="mx-auto w-2/3 pt-6">
        <div v-if="activePanel.panel" class="w-full flex flex-col gap-6">
          <div>
            <div class="panel-title">
              {{ activePanel.panel.title }}
            </div>
            <div class="panel-description">
              {{ activePanel.panel.description }}
            </div>
          </div>
          <template v-for="item in activePanel.panel.list" :key="item.subtitle">
            <div v-if="!item.hide?.()" :id="item.subId || item.subtitle">
              <div v-if="item.subtitle" class="pt-6 pb-3 panel-subtitle">
                {{ item.subtitle }}
              </div>
              <template v-for="subItem in item.items" :key="subItem.label">
                <div v-if="!subItem.hide?.(subItem, item.items)" class="panel-item">
                  <component :is="subItem.renderComponent" v-if="subItem.renderComponent" />
                  <div v-else class="flex flex-1 items-center gap-2" :class="subItem.classes">
                    <div class="flex-3/5">
                      <div class="panel-item-label">
                        <component :is="isFunction(subItem.label) ? subItem.label : () => subItem.label" />
                      </div>
                      <div v-if="subItem.text" class="whitespace-pre-wrap panel-item-text">
                        <component :is="isFunction(subItem.text) ? subItem.text : () => subItem.text" />
                      </div>
                    </div>
                    <div v-if="subItem.component" class="flex-3/10 flex justify-end w-full">
                      <component :is="subItem.component" v-model="subItem.value" :item="subItem" class="panel-item-value" />
                    </div>
                  </div>
                  <component :is="subItem.afterComponent" v-if="subItem.afterComponent" :item="subItem" />
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
    <TaskbarImagePreviewHost />
  </div>
</template>

<style lang="scss" scoped>
.close-btn {
  position: absolute !important;
  right: 16px;
  top: 16px;
}

.settings {
  &-menu {
    display: flex;
    width: 246px;
    height: 640px;
    padding: 24px 0px 0px 24px;
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
    flex-shrink: 0;

    &-title {
      display: flex;
      padding-left: 24px;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
    }

    &-list {
      display: flex;
      flex-direction: column;
      padding: 0px 20px;
      gap: 4px;
      width: 100%;

      &-item {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        gap: 12px;
        color: var(--colors-text-text-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        border-radius: 4px;
        transition: all 0.15s ease;

        &:hover {
          color: var(--colors-text-text-primary-hover);
          background: var(--pattern-sidenav-bg-hover, rgba(255, 255, 255, 0.05));
        }

        &.active {
          color: var(--pattern-sidenav-text-active);
          background: var(--pattern-sidenav-bg-active);
        }
      }
    }
  }

  &-content {
    padding-right: 24px;
    width: 100%;
    overflow-y: auto;
    margin: 4px 0;
  }
}

.panel {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
  }

  &-description {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: normal;
  }

  &-subtitle {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-item {
    padding: var(--spacing-2xl, 16px) 0px;
    border-bottom: 0.5px solid var(--colors-border-divider);

    &:last-of-type {
      border-bottom: none;
    }

    &-label {
      color: var(--colors-text-text-primary);
      font-size: 14px;
      font-weight: 500;
      line-height: normal;
      line-height: 20px;
    }

    &-text {
      color: var(--colors-text-text-tertiary);
      font-size: 12px;
      line-height: 20px;
    }

    &-value {
      color: var(--colors-text-text-primary);
      font-size: 12px;
      line-height: 20px;
    }
  }
}
</style>
