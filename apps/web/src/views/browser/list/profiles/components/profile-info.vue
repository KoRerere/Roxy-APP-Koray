<script lang="ts" setup>
import { getDefaultWindowName } from '/@/views/browser/create/utils'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { formatProxyTime, strConcat } from '/@/utils'
import CanvasLine from './canvas-line.vue';
import { usePopupMenu } from '/@/hooks/usePopupMenu';

interface Props {
  workspaceName?: string
  data: Record<string, any>
  openMessage?: Record<string, any>
  disabled?: boolean
  readonly?: boolean
  filterKeys?: string[]
}

const {
  workspaceName,
  data,
  openMessage,
  disabled = false,
  readonly = false,
  filterKeys = ['os', 'proxy', 'account']
} = defineProps<Props>()

const emits = defineEmits(['profileOperate'])

const OS_ICON: any = {
  windows: 'platforms/rx_os_windows',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const { showMenu: showPopupMenu } = usePopupMenu()
const role = useRoleStore()

const defaultWindowName = getDefaultWindowName()
const windowName = ref(data.windowName)

const isProxy = computed(() => data.proxyCategory !== 'noproxy')
const isOpenBrowser = computed(() => openMessage?.[data.dirId]?.data?.percent === 100)
const windowPlatformList = computed(() => data.windowPlatformList || [])
const list = computed(() => {
  const proxyClass = isProxy.value ? '' : data.lastIp ? 'direct-info' : 'direct'
  return [
    {
      key: 'os',
      svg: OS_ICON[(data.os as string).toLocaleLowerCase()],
      tooltip: $t('系统: {os} {osVersion}\n内核: Chrome {coreVersion}', {
        os: data.os === 'IOS' ? 'iOS' : data.os,
        osVersion: data.osVersion,
        coreVersion: data.coreVersion
      }),
    },
    {
      key: 'proxy',
      classes: proxyClass,
      svg: isProxy.value ? `country-code/${data.lastCountry}` : data.lastIp ? 'base/rx_ic_route2' : 'base/rx_ic_plus',
      tooltip: proxyClass === 'direct' ? undefined : $t('位置: {lastCountry}{lastCity}\nIP: {lastIp}\n检测时间: {checkTime}', {
        lastCountry: data.lastCountry || '--',
        lastCity: strConcat('/', data.lastCity) || '',
        lastIp: data.lastIp || '--',
        checkTime: data.checkTime ? formatProxyTime(data.checkTime) : '--',
      }),
    },
    {
      key: 'account',
      image: windowPlatformList.value[0]?.platformIcon,
      svg: windowPlatformList.value[0] ? 'base/rx_ic_user_key' : 'base/rx_ic_plus',
      svgColor: windowPlatformList.value[0] ? 'var(--Colors-Icon-icon-tertiary, #7C8387)' : 'var(--Colors-Icon-icon-secondary, #575D61)',
      classes: windowPlatformList.value.length > 1 ? 'stack' : '',
    },
  ].filter(item => filterKeys.includes(item.key))
})

function onClick(event: MouseEvent, key: string) {
  if (disabled || readonly) return

  switch (key) {
    case 'proxy': {
      const model = getProxyOperation()
      if (model.every(item => !item.visible)) return
      showPopupMenu(event, { model })
      break
    }
    case 'account': {
      const model = getAccountOperation()
      if (model.every(item => !item.visible)) return
      showPopupMenu(event, { model })
      break
    }
  }
}

function getProxyOperation() {
  return [
    {
      label: $t('添加代理'),
      icon: 'base/rx_ic_plus',
      visible: !isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'addProxy')
      },
    },
    {
      label: $t('选择代理'),
      icon: 'base/rx_ic_exchange',
      visible: !isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      label: $t('测试代理'),
      icon: 'base/rx_ic_speed_test',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'testProxy')
      },
    },
    {
      label: $t('刷新代理'),
      icon: 'base/rx_ic_refresh',
      visible: isProxy.value,
      disabled: !data.refreshUrl,
      command: () => {
        emits('profileOperate', 'refreshUrl')
      },
    },
    {
      visible: isProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('编辑代理'),
      icon: 'base/rx_ic_edit',
      visible: isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'editProxy')
      },
    },
    {
      label: $t('切换代理'),
      icon: 'base/rx_ic_exchange',
      visible: isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      visible: isProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('删除代理'),
      icon: 'base/rx_ic_bin_1',
      visible: isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'deleteProxy')
      },
    },
  ]
}

function getAccountOperation() {
  return [
    {
      label: $t('添加平台账号'),
      icon: 'base/rx_ic_plus',
      visible: !role.isViewer,
      command: () => {
        emits('profileOperate', 'addAccount')
      },
    },
    {
      label: $t('选择平台账号'),
      visible: !role.isViewer,
      icon: 'base/rx_ic_exchange',
      command: () => {
        emits('profileOperate', 'selectAccount')
      },
    },
  ]
}

function saveWindowName(closeCallback: () => void) {
  const name = windowName.value.trim()
  if (name !== data.windowName) {
    data.windowName = windowName.value
    emits('profileOperate', 'saveWindowName')
  } else {
    windowName.value = data.windowName
  }
  closeCallback()
}

function handleFocusWindowName() {
  windowName.value = windowName.value.startsWith(defaultWindowName) ? '' : windowName.value
}

function handleClickInplace(e: MouseEvent) {
  if (disabled || readonly) return
  e.stopPropagation()
}
</script>

<template>
  <div class="position-relative flex h-full items-center profile" :class="{ 'disabled-mask': disabled }">
    <div>
      <span class="profile-name">{{ workspaceName }}-</span>
      <span class="profile-num">{{ `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0') }}</span>
    </div>
    <div class="position-relative flex justify-between state" :class="{ 'w-[124px]': list.length > 1 }" @click.stop>
      <div v-for="item in list" :key="item.key" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }" class="state-item">
        <div class="flex-cc cursor-pointer state-icons" :class="item.classes" @click.stop="onClick($event, item.key)">
          <img v-if="item.image" :src="item.image" class="state-icons-img pointer-events-none">
          <RxSvgIcon v-else :name="item.svg" :color="item.svgColor" fallback="base/rx_ic_earth" class="pointer-events-none" />
        </div>
      </div>
      <div v-if="list.length > 1" class="state-line">
        <CanvasLine v-if="isOpenBrowser" :waveWidth="1.2" :blur="0" speed="fast" :waveOpacity="1"></CanvasLine>
        <div v-else class="w-[100px] border-0 border-t-0.5 border-dashed border-[#C7CDD1]"></div>
      </div>
    </div>
    <Inplace v-focustrap :disabled="disabled || readonly" @click="handleClickInplace">
      <template #display>
        <div class="profile-name-content">
          {{ windowName }}
          <!-- <RxSvgIcon name="base/rx_ic_edit" size="14" color="#A3A9AD" class="align-sub edit-window-name-icon" /> -->
        </div>
      </template>
      <template #content="{ closeCallback }">
        <InputText v-model="windowName" autofocus size="small" class="window-name-input" @blur="saveWindowName(closeCallback)" @focus="handleFocusWindowName"
          @keydown.enter="saveWindowName(closeCallback)" />
      </template>
    </Inplace>
  </div>
</template>

<style lang="scss" scoped>
$box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02),
  0px 1px 1px 0px rgba(0, 0, 0, 0.06);

.disabled-mask {
  filter: grayscale(100%);
}

.profile {
  gap: var(--spacing-xl, 12px);
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &-name {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: 'JetBrains Mono';
  }

  &-num {
    font-family: 'JetBrains Mono';
  }
}

.state {
  z-index: 0;

  &-line {
    z-index: -1;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
  }

  &-item {
    width: 24px;
    height: 24px;
  }

  &:hover {
    .direct {
      transform: scale(0.7);
      opacity: 1;
    }
  }

  &-icons {
    position: relative;
    padding: 3px;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
    background: var(--Colors-Background-bg-action-secondary, #fff);
    box-shadow: $box-shadow;
    transition: all 0.15s ease;

    &-img {
      width: 100%;
      height: 100%;
    }
  }
}

.stack {
  position: relative;
  width: 20px;
  height: 20px;
  transform-style: preserve-3d;

  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
    background: var(--Colors-Background-bg-inactive, #fafbfc);
    box-shadow: $box-shadow;
    transform: translateZ(-1px);
  }
}

.direct {
  transform: scale(0);
}

.direct-info {
  border: none;
  box-shadow: none;
  color: #a3a9ad;
  transition: all 0.2s;

  &:hover {
    color: #7c8387;
  }
}

.edit-window-name-icon {
  visibility: hidden;
}

:deep(.p-inplace-display) {
  display: flex;
  justify-content: center;
  border: 0 none;
  padding: 0;

  &:focus-visible {
    outline-color: transparent;
  }
}

.profile-name-content {
  width: 160px;
  height: 26px;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid transparent;
  border-radius: 4px;

  &:hover {
    border: 1px solid rgba(0, 0, 0, 0.1);
    background-color: rgba(255, 255, 255, 0.7);
  }
}

.window-name-input {
  font-size: 12px;
  border: 1px solid #12a3fc;
  border-radius: 4px;
  box-shadow: none !important;
  background-color: #fff !important;
  line-height: 16px;
  color: #171c1f;
  padding: 4px 8px;
  width: 160px;
}
</style>
