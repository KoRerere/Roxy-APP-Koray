<script setup lang="ts">
import { getOperationList } from './operation-list';
import { RxSvgIcon } from '/@/components/rx-icon';

const actionBarRef = useTemplateRef('actionBar')
const defaultWidth = ref('auto')
const formData = reactive({
})
const operationList = getOperationList(formData)

function handleMouseenter() {
  console.log('handleMouseenter')
  electronAPI.send('app:set-ignore-mouse-events', false)
}
function handleMouseleave() {
  console.log('handleMouseleave')
  electronAPI.send('app:set-ignore-mouse-events', true, { forward: true })
}

onMounted(() => {
  setTimeout(() => {
    defaultWidth.value = getComputedStyle(actionBarRef.value!).width
  }, 1000)
})
</script>

<template>
  <div ref="actionBar" class="action-bar" @mouseenter="handleMouseenter" @mouseleave="handleMouseleave">
    <div class="top-bar">
      <div class="sync-text">
        {{ $t('{count} 个窗口正在同步中', { count: 2 }) }}
      </div>
      <div class="actions">
        <div class="action-item">
          <RxSvgIcon name="base/rx_ic_show_profile" />
          {{ $t('显示所有窗口') }}
        </div>
        <div class="action-item stop">
          <RxSvgIcon name="base/rx_ic_pause" />
          {{ $t('停止') }}
        </div>
      </div>
    </div>
    <div class="bottom-bar">
      <Menubar :model="operationList">
        <template #item="{ item, props, hasSubmenu }">
          <a v-ripple :href="item.url" :target="item.target" v-bind="props.action">
            <RxSvgIcon v-if="item.icon" :name="item.icon" size="16px" />
            <span class="operation-label">{{ item.label }}</span>
            <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down" />
          </a>
        </template>
      </Menubar>
      <div class="split-line"></div>
      <div class="other-item">
        <RxSvgIcon name="base/rx_ic_list" />
      </div>
      <div class="other-item">
        <RxSvgIcon name="base/rx_ic_gear" />
      </div>
    </div>
  </div>
</template>

<style>
html,
body {
  background: transparent !important;
}

#app {
  display: flex;
  justify-content: center;
  --p-menubar-background: transparent;
  --p-menubar-border-color: transparent;
}
</style>

<style lang="scss" scoped>
.action-bar {
  width: v-bind(defaultWidth);
  display: flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  color: white;
  overflow: hidden;
  gap: 4px;
  border-radius: 8px;
  word-break: keep-all;
  white-space: nowrap;
  background: var(--Color-neutrals-950, #0e1214);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  transition: all 0.3s linear;

  &:hover {
    width: 604px;
    padding: var(--spacing-xl, 12px);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);

    .bottom-bar {
      display: flex;
    }

  }

}

.top-bar {
  width: 100%;
  display: flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  justify-content: space-between;
  gap: 4px;

  .sync-text {
    display: flex;
    padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
    align-items: flex-start;
    gap: 6px;
    color: #0cef4c;
    text-align: center;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;

    .action-item {
      display: flex;
      padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
      align-items: flex-start;
      gap: 4px;
      border-radius: 5px;
      border: 0.5px solid var(--Color-neutrals-600, #575d61);
      background: var(--Color-neutrals-800, #252a2e);
      color: var(--Component-Colors-0, #fff);
      text-align: center;
      font-family: Inter;
      font-size: 13px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      cursor: pointer;

      &.stop {
        color: var(--Colors-Text-text-error, #F53838);
        text-align: center;
        font-family: Inter;
        font-size: 13px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
        /* 123.077% */
      }
    }
  }
}




.bottom-bar {
  display: none;
  align-items: center;
  gap: 10px;
  align-self: stretch;

  :deep(.p-menubar) {
    padding: 0;
  }

  :deep(.p-menubar-root-list) {
    flex-wrap: nowrap;

    >.p-menubar-item>.p-menubar-item-content {
      --p-menubar-item-active-background: var(--Color-neutrals-800, #252A2E);
      --p-menubar-item-focus-background: var(--Color-neutrals-800, #252A2E);
      color: var(--Colors-Alpha-alpha-white-90, rgba(255, 255, 255, 0.90));

      .p-menubar-item-link {
        display: flex;
        padding: 8px;
        justify-content: center;
        align-items: center;
        gap: var(--spacing-md, 6px);
        flex: 1 0 0;
      }
    }
  }

  .operation-label {
    text-align: center;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    line-height: 16px;
  }

  .split-line {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.20);
  }

  .other-item {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px;
    cursor: pointer;
    border-radius: 6px;

    &:hover {
      background-color: var(--Color-neutrals-800, #252A2E);
    }
  }
}
</style>
