<script setup lang="ts">
import { isFunction } from "es-toolkit";
import RxButton from "/@/components/rx-button";
import { RxSvgIcon, type SvgNames } from "/@/components/rx-icon/";
import { $t } from "/@/locales";
import { useSettingsPopup } from "./settings-popup/";

const dialogRef = inject<any>("dialogRef");

const { activePanel, panels, initPanels } = useSettingsPopup();

function closePopup() {
  dialogRef.value.close();
}

onBeforeMount(() => {
  activePanel.key = dialogRef.value.data.props.activeKey;
  initPanels();
});
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
      <RxButton icon="base/rx_ic_delete" text severity="secondary" size="lg" class="close-btn" @click="closePopup">
      </RxButton>
    </div>
    <div class="settings-content">
      <div class="settings-content-wrapper">
        <div v-if="activePanel.panel" class="w-full panel">
          <div>
            <div class="panel-title">
              {{ activePanel.panel.title }}
            </div>
            <div class="panel-description">
              {{ activePanel.panel.description }}
            </div>
          </div>
          <div v-for="item in activePanel.panel.list" :key="item.subtitle">
            <div v-if="item.subtitle" class="mb-3 text-[16px] font-bold text-black">
              {{ item.subtitle }}
            </div>
            <template v-for="subItem in item.items" :key="subItem.label">
              <div v-if="!subItem.hide?.(subItem, item.items)" class="panel-item">
                <div class="flex flex-1 items-center" :class="subItem.classes">
                  <div class="flex-1">
                    <div class="panel-item-label">
                      <component :is="isFunction(subItem.label) ? subItem.label : () => subItem.label" />
                    </div>
                    <div class="whitespace-pre-wrap panel-item-text">
                      <component :is="isFunction(subItem.text) ? subItem.text : () => subItem.text" />
                    </div>
                  </div>
                  <div v-if="subItem.component" class="flex-1 flex justify-end w-full">
                    <component :is="subItem.component" v-model="subItem.value" :item="subItem" class="panel-item-value" />
                  </div>
                </div>
                <component :is="subItem.afterComponent" v-if="subItem.afterComponent" :item="subItem" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
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
    padding: var(--spacing-4xl, 24px) 0px 0px var(--spacing-4xl, 24px);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-4xl, 24px);
    flex-shrink: 0;

    &-title {
      display: flex;
      padding-left: 24px;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      color: #000;
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
    }

    &-list {
      display: flex;
      flex-direction: column;
      padding: 0px var(--spacing-3xl, 20px);
      gap: var(--spacing-sm, 4px);
      width: 100%;

      &-item {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        gap: var(--spacing-xl, 12px);
        color: var(--Component-Colors-SideNav-link-text, #575d61);
        font-size: var(--Font-Size-text-md, 14px);
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
    margin: 8px 0;
    margin-top: 0;

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
    padding: var(--spacing-2xl, 16px) 0px;
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

    &:last-of-type {
      border-bottom: none;
    }

    &-label {
      color: #000;
      font-family: Inter;
      font-size: 14px;
      font-weight: 500;
      line-height: normal;
      line-height: var(--Line-Height-text-xs, 20px);
    }

    &-text {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-size: 12px;
      font-family: Inter;
      line-height: var(--Line-Height-text-xs, 20px);
    }

    &-value {
      color: #000;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>
