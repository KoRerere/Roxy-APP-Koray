<script setup lang="ts">
import { getOperationList } from './operation-list';

import { RxSvgIcon } from '/@/components/rx-icon';
import { preferenceSettings } from '../model'
import { savePreferenceSettings } from '/@/views/sync-control/util';
import { useUserStore } from '/@/stores/user';
import { merge } from 'es-toolkit';
import { hidePageLoading, isWindows } from '/@/utils';
import { $t } from '/@/locales';

const os = isWindows ? 'windows' : 'mac'

const isDragging = ref(false);
const { getUserConfig, } = useUserStore()
const actionBarRef = useTemplateRef('actionBar')
const bottomBarRef = useTemplateRef('bottomBar')

const kernelNoSame = ref(false)
const defaultWidth = ref('auto')
const syncWindowCount = ref(0)
const formData = ref(preferenceSettings)
const operationList = ref(getOperationList(formData))
let removeHoverTimer: any = null
let dragTimer: any = null

hidePageLoading()
let requestAnimationFrameId: any = null

// TODO 后续要优化
function hidePageLoadingFn() {
  hidePageLoading()
  requestAnimationFrameId = requestAnimationFrame(hidePageLoadingFn)
}

hidePageLoadingFn()

setTimeout(() => {
  cancelAnimationFrame(requestAnimationFrameId)
}, 5000)

const syncWindowListTooltip = computed(() => {
  const openSyncWindowList = formData.value.shortcutKey[os].openSyncWindowList
  return $t('同步窗口列表') + (openSyncWindowList ? ` (${openSyncWindowList})` : '')
})

const settingsTooltip = computed(() => {
  const preferenceSettings = formData.value.shortcutKey[os].openPreferenceSettings
  return $t('设置') + (preferenceSettings ? ` (${preferenceSettings})` : '')
})

watch(isDragging, (newVal) => {
  if (newVal) {
    electronAPI.send('app:startMoveWindow')
  } else {
    electronAPI.send('app:stopMoveWindow')
  }
})

function handleMouseenter() {
  clearTimeout(removeHoverTimer)
  console.log('handleMouseenter')
  electronAPI.send('app:set-ignore-mouse-events', false)
  initUserConfig()
}
function handleMouseleave() {
  clearTimeout(removeHoverTimer)
  console.log('handleMouseleave')
  electronAPI.send('app:set-ignore-mouse-events', true, { forward: true })
  removeHoverTimer = setTimeout(() => {
    actionBarRef.value!.classList.remove('hover')
  }, 1900)
  // actionBarRef.value?.style.setProperty('-webkit-app-region', 'no-drag')
  // 触发 menuBar 的失焦事件，隐藏菜单
  bottomBarRef.value?.click()
}

window.addEventListener('blur', handleMouseleave);
window.addEventListener('mouseup', () => {
  clearTimeout(dragTimer)
  isDragging.value = false;
});

function handleMousedown(event: MouseEvent) {
  dragTimer = setTimeout(() => {
    isDragging.value = true;
  }, 100)
}

function handleMouseenterSyncText() {
  console.log('handleMouseenterSyncText')
  actionBarRef.value!.classList.add('hover')
}

function showAllWindows() {
  electronAPI.send('syncControl:showAll')
}

function stopSync() {
  electronAPI.send('syncControl:stop')
}

function showPreferences() {
  electronAPI.send('syncControl:openPreferencesDialog');
}

function showSyncingWindowListDialog() {
  electronAPI.send('syncControl:openSyncingWindowListDialog');
}

window.electronAPI.on('browser:on-close', (dirId) => {
  getAllSyncingWindows()
})

async function getAllSyncingWindows() {
  const windowList = await window.electronAPI.send('syncControl:getAllSyncingWindows')
  console.log('windowList', windowList)
  kernelNoSame.value = windowList.some((item) => item.coreVersion !== windowList[0].coreVersion)
}

async function initUserConfig() {
  const userSetting = await getUserConfig(true)
  if (userSetting?.preferenceSettings) {
    Object.keys(formData.value).forEach(key => {
      if (Reflect.has(userSetting.preferenceSettings!, key)) {
        merge(formData.value[key], userSetting.preferenceSettings![key])
      }
    })
    operationList.value = getOperationList(formData)
  }
}

onMounted(async () => {
  setTimeout(() => {
    defaultWidth.value = getComputedStyle(actionBarRef.value!).width
    document.body.style.pointerEvents = 'auto'
  }, 60)
  getAllSyncingWindows()
  await initUserConfig()

  watch(formData, (newVal) => {
    savePreferenceSettings(newVal)
  }, { deep: true })
})

electronAPI.on('syncControl:toggleClickDelay', () => {
  formData.value.simulate.enableClickDelay = !formData.value.simulate.enableClickDelay
  savePreferenceSettings(toRaw(formData.value))
})

electronAPI.on('syncControl:toggleInputDelay', () => {
  formData.value.simulate.enableInputDelay = !formData.value.simulate.enableInputDelay
  savePreferenceSettings(toRaw(formData.value))
})

electronAPI.send('syncControl:getSyncWindowCount').then((count) => {
  syncWindowCount.value = count
})
electronAPI.send('app:showCurrentWebviewWindow')

const cancelListener = electronAPI.on('syncControl:syncWindowCountChange', (count) => {
  syncWindowCount.value = count
})

onUnmounted(() => {
  cancelListener()
})
</script>

<template>
  <div ref="actionBar" class="action-bar" @mouseenter="handleMouseenter" @mouseleave="handleMouseleave"
    @mousedown="handleMousedown">
    <div class="top-bar">
      <div class="sync-text" @mouseenter="handleMouseenterSyncText">
        {{ $t('{count} 个窗口正在同步中', { count: syncWindowCount }) }}
        <div class="dots"></div>
      </div>
      <div class="actions">
        <div class="action-item" @click="showAllWindows">
          <RxSvgIcon name="base/rx_ic_show_profile" />
          {{ $t('显示所有窗口') }}
        </div>
        <div class="action-item stop" @click="stopSync">
          <RxSvgIcon name="base/rx_ic_pause" />
          {{ $t('停止同步') }}
        </div>
      </div>
    </div>
    <div ref="bottomBar" class="bottom-bar">
      <div class="menubar-container">
        <Menubar :model="operationList">
          <template #item="{ item, props, hasSubmenu }">
            <a v-ripple :href="item.url" :target="item.target" v-bind="props.action">
              <RxSvgIcon v-if="item.icon" :name="item.icon" size="16px" />
              <span class="operation-label">{{ item.label }}</span>
              <span v-if="item.suffix" @click.stop>
                <component :is="item.suffix" />
              </span>
              <span v-if="item.shortcutKey" class="shortcut-key">{{ item.shortcutKey }}</span>
              <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down" />
            </a>
          </template>
        </Menubar>
        <div class="split-line"></div>
        <div class="other-item"
          v-tooltip.top="{ value: syncWindowListTooltip, pt: { text: '!whitespace-nowrap !break-keep' } }"
          @click="showSyncingWindowListDialog">
          <RxSvgIcon name="base/rx_ic_list_2" />
        </div>
        <div class="other-item" v-tooltip.top="settingsTooltip" @click="showPreferences">
          <RxSvgIcon name="base/rx_ic_gear" />
        </div>
      </div>

      <div class="tips" v-if="kernelNoSame">
        {{ $t('注意：窗口的内核不一致可能会影响同步操作的效果') }}
      </div>

    </div>
  </div>
</template>

<style lang="scss">
:root,
html,
body {
  background: transparent !important;
  pointer-events: none;
  user-select: none;
}

#app {
  display: flex;
  justify-content: center;
  --p-menubar-background: transparent;
  --p-menubar-border-color: transparent;

  .p-toggleswitch {
    transform: scale(0.7);
    transform-origin: left bottom;
  }
}
</style>

<style lang="scss" scoped>
.action-bar {
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
  transition: all 0.1s linear;

  &.hover {
    width: fit-content;
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
    gap: 2px;
    color: #0cef4c;
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
      font-size: 13px;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      cursor: pointer;
      transition: all 0.15s ease-in-out;

      &:hover {
        background: var(--Color-neutrals-700, #343A3D);
      }

      &.stop {
        color: var(--Colors-Text-text-error, #F53838);
        text-align: center;
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
  flex-direction: column;
  gap: 10px;
  align-self: stretch;

  .menubar-container {
    display: flex;
    align-items: center;
    gap: 10px;
    align-self: stretch;

    .shortcut-key {
      margin-left: 12px;
      color: var(--Colors-Text-text-inactive, #A3A9AD);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
    }
  }

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
        align-items: center;
        gap: var(--spacing-md, 6px);
        flex: 1 0 0;
      }
    }

    .p-menubar-item-link {
      justify-content: space-between;
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


  .tips {
    color: var(--Color-yellow-300, #FC9D12);
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    margin-left: 10px;
    padding-bottom: 4px;
  }
}


.dots {
  width: 20px;
}

/* 动画效果 */
.dots::after {
  content: "";
  animation: loadingDots 1.5s steps(5, end) infinite;
}

/* 动画关键帧 */
@keyframes loadingDots {
  0% {
    content: ".";
  }

  33% {
    content: "..";
  }

  66% {
    content: "...";
  }

  100% {
    content: ".";
  }
}
</style>
