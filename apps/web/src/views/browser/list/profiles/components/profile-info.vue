<script lang="ts" setup>
import { getDefaultWindowName } from '../../../create/utils'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useContextMenu } from '/@/hooks/useContextMenu'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { formatProxyTime, strConcat } from '/@/utils'

const props = defineProps({
  workspaceName: {
    type: String,
  },
  data: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  openMessage: {
    type: Object,
    default: () => ({}),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  filterKeys: {
    type: Array as PropType<string[]>,
    default: ['os', 'proxy', 'account'],
  },
})
const emits = defineEmits(['profileOperate'])

const defaultWindowName = getDefaultWindowName()
const windowName = ref(props.data.windowName)

const isOpenBrowser = computed(() => {
  return props.openMessage[props.data.dirId]?.data?.percent === 100
})

const role = useRoleStore()
const os_image: any = {
  windows: 'platforms/rx_os_windows',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const data = computed(() => props.data)
const isProxy = computed(() => data.value.proxyCategory !== 'noproxy')
const windowPlatformList = computed(() => data.value.windowPlatformList || [])

const list = computed(() => {
  const proxyClass = isProxy.value ? '' : data.value.lastIp ? 'direct-info' : 'direct'
  return [
    {
      key: 'os',
      svg: os_image[(data.value.os as string).toLocaleLowerCase()],
      tooltip: $t('系统: {os} {osVersion}\n内核: Chrome {coreVersion}', { os: data.value.os, osVersion: data.value.osVersion, coreVersion: data.value.coreVersion }),
    },
    {
      key: 'proxy',
      classes: proxyClass,
      svg: isProxy.value ? `country-code/${data.value.lastCountry}` : data.value.lastIp ? 'base/rx_ic_route2' : 'base/rx_ic_plus',
      tooltip: proxyClass === 'direct' ? undefined : $t('位置: {lastCountry}{lastCity}\nIP: {lastIp}\n检测时间: {checkTime}', {
        lastCountry: data.value.lastCountry || '--',
        lastCity: strConcat('/', data.value.lastCity) || '',
        lastIp: data.value.lastIp || '--',
        checkTime: data.value.checkTime ? formatProxyTime(data.value.checkTime) : '--',
      }),
    },
    {
      key: 'account',
      image: windowPlatformList.value[0]?.platformIcon,
      svg: windowPlatformList.value[0] ? 'base/rx_ic_user_key' : 'base/rx_ic_plus',
      svgColor: windowPlatformList.value[0] ? 'var(--Colors-Icon-icon-tertiary, #7C8387)' : 'var(--Colors-Icon-icon-secondary, #575D61)',
      classes: windowPlatformList.value.length > 1 ? 'stack' : '',
    },
  ].filter(item => props.filterKeys.includes(item.key))
})

const [show] = useContextMenu()

function onClick(event: Event, key: string) {
  if (props.disabled || props.readonly) {
    return
  }

  switch (key) {
    case 'proxy':
      show(event, { model: getProxyOperation() })
      break
    case 'account':
      show(event, { model: getAccountOperation() })
      break
  }
}

function getProxyOperation() {
  return [
    {
      label: $t('添加代理'),
      visible: !isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'addProxy')
      },
    },
    {
      label: $t('选择代理'),
      visible: !isProxy.value,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      label: $t('测试代理'),
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'testProxy')
      },
    },
    {
      label: $t('刷新代理'),
      visible: isProxy.value,
      disabled: !data.value.refreshUrl,
      command: () => {
        emits('profileOperate', 'refreshUrl')
      },
    },
    {
      visible: isProxy.value,
      separator: true,
    },
    {
      label: $t('编辑代理'),
      visible: isProxy.value && !role.isViewer,
      command: () => {
        emits('profileOperate', 'editProxy')
      },
    },
    {
      label: $t('切换代理'),
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      visible: isProxy.value,
      separator: true,
    },
    {
      label: $t('删除代理'),
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
      visible: !role.isViewer,
      command: () => {
        emits('profileOperate', 'addAccount')
      },
    },
    {
      label: $t('选择平台账号'),
      command: () => {
        emits('profileOperate', 'selectAccount')
      },
    },
  ]
}

function saveWindowName(closeCallback: () => void,) {
  const name = windowName.value.trim()
  if (name !== props.data.windowName) {
    props.data.windowName = windowName.value
    emits('profileOperate', 'saveWindowName')
  } else {
    windowName.value = props.data.windowName
  }
  closeCallback()
}

function handleFocusWindowName() {
  windowName.value = windowName.value.startsWith(defaultWindowName) ? '' : windowName.value
}

function handleClickInplace(e: MouseEvent) {
  if (props.disabled || props.readonly) {
    return
  }
  e.stopPropagation()
}
</script>

<template>
  <div class="position-relative flex h-full items-center profile" :class="{ 'disabled-mask': disabled }">
    <div>
      <span class="profile-name">{{ workspaceName }}-</span>
      <span class="profile-num">{{ `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0') }}</span>
    </div>
    <div class="position-relative flex justify-between state" :class="{ 'w-[104px]': list.length > 1 }" @click.stop>
      <div v-for="item in list" :key="item.key" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }"
        class="state-item">
        <div class="flex-cc cursor-pointer state-icons" :class="item.classes" @click.stop="onClick($event, item.key)">
          <img v-if="item.image" :src="item.image" class="state-icons-img pointer-events-none">
          <RxSvgIcon v-else :name="item.svg" :color="item.svgColor" fallback="base/rx_ic_earth"
            class="pointer-events-none" />
        </div>
      </div>
      <div v-if="list.length > 1" class="state-line">
        <svg v-if="isOpenBrowser" xmlns="http://www.w3.org/2000/svg" width="60" height="5" viewBox="0 0 60 5"
          fill="none">
          <g>
            <path
              d="M0 2.5C1 0.5 2 0.5 3 2.5C4 4.5 5 4.5 6 2.5C7 0.5 8 0.5 9 2.5C10 4.5 11 4.5 12 2.5C13 0.5 14 0.5 15 2.5C16 4.5 17 4.5 18 2.5C19 0.5 20 0.5 21 2.5C22 4.5 23 4.5 24 2.5C25 0.5 26 0.5 27 2.5C28 4.5 29 4.5 30 2.5C31 0.5 32 0.5 33 2.5C34 4.5 35 4.5 36 2.5C37 0.5 38 0.5 39 2.5C40 4.5 41 4.5 42 2.5C43 0.5 44 0.5 45 2.5C46 4.5 47 4.5 48 2.5C49 0.5 50 0.5 51 2.5C52 4.5 53 4.5 54 2.5C55 0.5 56 0.5 57 2.5C58 4.5 59 4.5 60 2.5"
              stroke="#12A3FC" />
          </g>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="60" height="5" viewBox="0 0 60 5" fill="none">
          <line y1="2.5" x2="60" y2="2.5" stroke="#C7CDD1" stroke-dasharray="2 2" />
        </svg>
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
        <InputText v-model="windowName" autofocus size="small" class="window-name-input"
          @blur="saveWindowName(closeCallback)" @focus="handleFocusWindowName"
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

    &:hover {
      .direct {
        transform: scale(0.7);
        opacity: 1;
      }
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
    transition: all 0.5s ease;

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
  color: #A3A9AD;
  transition: all .2s;

  &:hover {
    color: #7C8387;
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
  border: 1px solid #12A3FC;
  border-radius: 4px;
  box-shadow: none !important;
  background-color: #fff !important;
  line-height: 16px;
  color: #171C1F;
  padding: 4px 8px;
  width: 160px;
}
</style>
