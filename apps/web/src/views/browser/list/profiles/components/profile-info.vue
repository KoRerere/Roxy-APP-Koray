<script lang="ts" setup>
import { getDefaultWindowName } from '/@/views/browser/create/utils'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { createDefaultObject, formatProxyTime, isLikeFunction, strConcat } from '/@/utils'
import CanvasLine from './canvas-line.vue';
import { usePopupMenu } from '/@/hooks/usePopupMenu';
import { useDrawer } from '/@/hooks/useDrawer'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useConfirm } from 'primevue/useconfirm'
import { useCheckProxy } from '/@/views/agent/hooks'

import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyList from '/@/views/agent/list/quick.vue'
import AccountCreate from '/@/views/account/create'
import AccountEdit from '/@/views/account/create/batch-edit.vue'
import AccountList from '/@/views/account/list/quick.vue'
import { API } from '/@/api'
import { ProfileModifyType, ProxyCheckStatus } from '/@/enums'
import { silentUpdateProxy, silentUpdateAccount } from './util';

interface Props {
  workspaceName?: string
  data: Record<string, any>
  openMessage?: Record<string, any>
  showSort?: boolean,
  disabled?: boolean
  readonly?: boolean
  filterKeys?: string[]
}

const {
  workspaceName,
  data,
  openMessage,
  showSort = true,
  disabled = false,
  readonly = false,
  filterKeys = ['os', 'proxy', 'account']
} = defineProps<Props>()

const emits = defineEmits(['refresh'])

const OS_ICON: any = {
  windows: 'platforms/rx_os_windows',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const confirm = useConfirm()
const drawerInstance = useDrawer()
const role = useRoleStore()
const { showMenu: showPopupMenu } = usePopupMenu()
const [showToast, onlyErrorToast] = useResponseToast()
const [checkProxy] = useCheckProxy()

const defaultWindowName = getDefaultWindowName()
const windowName = ref(data.windowName)

const hasProxy = computed(() => data.proxyCategory !== 'noproxy')
const isOpenBrowser = computed(() => openMessage?.[data.dirId]?.data?.percent === 100)

const list = computed(() => {
  const proxyClass = hasProxy.value ? '' : data.lastIp ? 'direct-info' : 'direct'
  const windowPlatformList = data.windowPlatformList || []
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
      svg: hasProxy.value ? `country-code/${data.lastCountry}` : data.lastIp ? 'base/rx_ic_route2' : 'base/rx_ic_plus',
      tooltip: proxyClass === 'direct' ? undefined : $t('位置: {lastCountry}{lastCity}\nIP: {lastIp}\n检测时间: {checkTime}', {
        lastCountry: data.lastCountry || '--',
        lastCity: strConcat('/', data.lastCity) || '',
        lastIp: data.lastIp || '--',
        checkTime: data.checkTime ? formatProxyTime(data.checkTime) : '--',
      }),
    },
    {
      key: 'account',
      image: windowPlatformList[0]?.platformIcon,
      svg: windowPlatformList[0] ? 'base/rx_ic_user_key' : 'base/rx_ic_plus',
      svgColor: windowPlatformList[0] ? 'var(--Colors-Icon-icon-tertiary, #7C8387)' : 'var(--Colors-Icon-icon-secondary, #575D61)',
      showSub: windowPlatformList.length > 1,
      subImage: windowPlatformList.length > 2 ? undefined : windowPlatformList[1]?.platformIcon,
      // tooltip: windowPlatformList?.map((item: any) => item.platformUserName).filter(Boolean).join('\n')
    },
  ].filter(item => filterKeys.includes(item.key))
})

function onClick(event: MouseEvent, key: string) {
  if (disabled || readonly) return

  switch (key) {
    case 'proxy': {
      const model = getProxyModel()
      if (model.every(item => !item.visible)) return
      showPopupMenu(event, { model })
      break
    }
    case 'account': {
      const model = getAccountModel()
      if (model.every(item => !item.visible)) return
      showPopupMenu(event, { model })
      break
    }
  }
}

function getProxyModel() {

  const proxyData = {
    id: data.moduleId,
    ...Object.fromEntries(
      ['host', 'ipType', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'checkChannel']
        .map(key => [key, data[key]])
    )
  }

  return [
    {
      label: $t('添加代理'),
      icon: 'base/rx_ic_plus',
      visible: !hasProxy.value && !role.isViewer,
      command: () => {
        createProxy()
      },
    },
    {
      label: $t('选择已有代理'),
      icon: 'base/rx_ic_exchange',
      visible: !hasProxy.value && !role.isViewer,
      command: () => {
        chooseProxy(proxyData)
      },
    },
    {
      label: $t('测试代理'),
      icon: 'base/rx_ic_speed_test',
      visible: hasProxy.value,
      command: async () => {
        const checkRes = await checkProxy(toRaw(data))
        if (data.moduleId) {
          API.proxy.userMdfProxyModuleCreate([{ id: data.moduleId, ...checkRes }] as any)
        }
        if (checkRes.checkStatus === ProxyCheckStatus.success) {
          updateProfile({ id: data.id, dirId: data.dirId, ...checkRes }, {
            success: () => silentUpdateProxy(data, checkRes)
          })
        }
      },
    },
    {
      label: $t('刷新代理'),
      icon: 'base/rx_ic_refresh',
      visible: hasProxy.value,
      disabled: !data.refreshUrl,
      command: async () => {
        const isOK = await window.electronAPI.send('proxy:refreshUrl', data.refreshUrl)
        showToast(isOK ? 0 : -1, data.refreshUrl)
      },
    },
    {
      visible: hasProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('编辑代理'),
      icon: 'base/rx_ic_edit',
      visible: hasProxy.value && !role.isViewer,
      command: () => {
        createProxy(proxyData)
      },
    },
    {
      label: $t('选择已有代理'),
      icon: 'base/rx_ic_exchange',
      visible: hasProxy.value && !role.isViewer,
      command: () => {
        chooseProxy(proxyData)
      },
    },
    {
      visible: hasProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('删除代理'),
      icon: 'base/rx_ic_bin_1',
      visible: hasProxy.value && !role.isViewer,
      command: () => {
        confirm.require({
          header: $t('删除代理'),
          message: $t('您确认要删除代理吗？'),
          rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
          acceptProps: { label: $t('确认'), severity: 'danger' },
          accept: async () => {
            const params = {
              id: data.id,
              dirId: data.dirId,
              moduleId: 0, // 为 0 表示解除关联
              proxyCategory: 'noproxy',
              proxyMethod: 'custom',
              ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'], ''),
            }
            updateProfile(params, {
              success: () => {
                if (!data.openTime) Reflect.set(params, 'lastIp', '')
                silentUpdateProxy(data, params)
              }
            })
          }
        })
      },
    },
  ]
}

function getAccountModel() {
  return [
    {
      label: $t('编辑平台账号'),
      icon: 'base/rx_ic_edit',
      visible: !role.isViewer && data.windowPlatformList.length > 0,
      command: () => {
        drawerInstance.showDrawer({
          title: $t('为[{workspaceName}-{uid}]编辑平台账号', { workspaceName, uid: data.windowSortNum }),
          dismissable: false,
          slots: {
            container: () => h(AccountEdit, {
              datas: data.windowPlatformList,
              onConfirm: async ({ platformUrlIds, windowPlatformList }: any) => {
                const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
                  type: ProfileModifyType.PlatformEdit,
                  ids: [data.id],
                  paramList: {
                    platformUrlIds,
                    windowPlatformList
                  }
                })
                drawerInstance.hideDrawer()
                onlyErrorToast(code, msg)
                if (code === 0) {
                  silentUpdateAccount(data, windowPlatformList)
                }
              }
            })
          }
        })
      }
    },
    {
      separator: true,
      visible: !role.isViewer && data.windowPlatformList.length > 0,
    },
    {
      label: $t('添加平台账号'),
      icon: 'base/rx_ic_plus',
      visible: !role.isViewer,
      command: () => {
        drawerInstance.showDrawer({
          title: $t('为[{workspaceName}-{uid}]添加平台账号', { workspaceName, uid: data.windowSortNum }),
          dismissable: false,
          slots: {
            container: () => h(AccountCreate, {
              showRemark: false,
              showCreateMore: false,
              onClose: () => {
                drawerInstance.hideDrawer()
              },
              onConfirm: async (formData: any) => {
                const { id, dirId, windowPlatformList } = data
                const _windowPlatformList = windowPlatformList.concat({
                  ...formData,
                  _tempId: Date.now().toString(32)
                })
                await updateProfile({ id, dirId, windowPlatformList: _windowPlatformList }, {
                  success: () => {
                    silentUpdateAccount(data, _windowPlatformList)
                  }
                })
              }
            })
          }
        })
      },
    },
    {
      label: $t('选择已有平台账号'),
      icon: 'base/rx_ic_exchange',
      visible: !role.isViewer,
      command: () => {
        drawerInstance.showDrawer({
          title: $t('为[{workspaceName}-{uid}]选择平台账号', { workspaceName, uid: data.windowSortNum }),
          dismissable: false,
          slots: {
            container: () => h(AccountList, {
              data,
              onConfirm: async (dataList: any[]) => {
                drawerInstance.hideDrawer()
                const { id, dirId, windowPlatformList } = data
                const platformUrlIds = dataList.filter(item => item.id).map(item => item.id)
                await updateProfile({ id, dirId, platformUrlIds }, {
                  success: () => {
                    const _windowPlatformList = windowPlatformList.filter((item: any) => !item.id).concat(dataList)
                    silentUpdateAccount(data, _windowPlatformList)
                  }
                })
              }
            })
          }
        })
      },
    },
  ]
}

function createProxy(proxyData?: Record<string, any>) {
  drawerInstance.showDrawer({
    title: proxyData
      ? $t('为[{workspaceName}-{uid}]编辑代理', { workspaceName, uid: data.windowSortNum })
      : $t('为[{workspaceName}-{uid}]添加代理', { workspaceName, uid: data.windowSortNum }),
    dismissable: false,
    slots: {
      container: () => h(ProxyCreate, {
        data: proxyData,
        onConfirm: (formData: any) => {
          const { id, dirId } = data
          const params = { ...formData, id, dirId, moduleId: 0, proxyMethod: 'custom' }
          updateProfile(params, {
            success: () => silentUpdateProxy(data, params)
          })
          drawerInstance.hideDrawer()
        }
      })
    }
  })
}

function chooseProxy(proxyData: Record<string, any>) {
  drawerInstance.showDrawer({
    title: $t('为[{workspaceName}-{uid}]选择代理', { workspaceName, uid: data.windowSortNum }),
    dismissable: false,
    slots: {
      container: () => h(ProxyList, {
        data: proxyData,
        onConfirm: ({ id: moduleId, proxyCategory, protocol, ...formData }: any) => {
          const { id, dirId } = data
          updateProfile({ id, dirId, moduleId, proxyMethod: 'choose' }, {
            success: () => silentUpdateProxy(data, { ...formData, moduleId, protocol, proxyCategory: proxyCategory || protocol, proxyMethod: 'choose' })
          })
          drawerInstance.hideDrawer()
        }
      })
    }
  })
}

async function updateProfile(params: any, options?: Record<string, any>) {
  const { isRefresh, fallback, success } = { isRefresh: false, success: () => { }, fallback: () => { }, ...options }
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    isLikeFunction(success) && success()
    if (isRefresh) {
      emits('refresh')
    }
  } else {
    isLikeFunction(fallback) && fallback()
  }
}

function saveWindowName(closeCallback: () => void) {
  const name = windowName.value.trim()
  const oldName = data.windowName
  if (name !== oldName) {
    data.windowName = name
    updateProfile({ id: data.id, windowName: name }, {
      fallback: () => {
        windowName.value = oldName
        data.windowName = oldName
      }
    })
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
    <div v-if="showSort">
      <span class="profile-name">{{ workspaceName }}-</span>
      <span class="profile-num">{{ `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0') }}</span>
    </div>
    <div class="position-relative flex justify-between state" :class="{ 'w-[136px]': list.length > 1 }" @click.stop>
      <div class="relative" v-for="item in list" :key="item.key" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }" @click.stop="onClick($event, item.key)">
        <div class="relative flex-cc cursor-pointer pa-1 state-icons" :class="item.classes">
          <img v-if="item.image" :src="item.image" class="block w-5 h-5 pointer-events-none">
          <RxSvgIcon v-else class="w-5 h-5 pointer-events-none" fallback="base/rx_ic_earth" :name="item.svg" :color="item.svgColor" />
        </div>
        <div v-if="item.showSub" class="absolute top-0.5 right-0 -translate-y-1/2 translate-1/2 flex-cc cursor-pointer pa-0.5 state-icons" :class="item.classes">
          <img v-if="item.subImage" :src="item.subImage" class="block w-3 h-3 pointer-events-none">
          <RxSvgIcon v-else class="w-3 h-3 pointer-events-none" fallback="base/rx_ic_earth" name="base/rx_ic_more-h" :color="item.svgColor" />
        </div>
      </div>
      <div v-if="list.length > 1" class="state-line">
        <CanvasLine v-if="isOpenBrowser" :waveWidth="1.2" :blur="0" speed="fast" :waveOpacity="1"></CanvasLine>
        <div v-else class="w-[100px] border-0 border-t-0.5 border-dashed border-[#C7CDD1]"></div>
      </div>
    </div>
    <Inplace v-focustrap :disabled="disabled || readonly" @click="handleClickInplace">
      <template #display>
        <div class="profile-name-content">{{ windowName }}</div>
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
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &-name {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: 'JetBrains Mono';
  }

  &-num {
    font-family: 'JetBrains Mono';
  }
}

.state {
  z-index: 0;

  &:hover {
    .direct {
      transform: scale(0.7);
      opacity: 1;
    }
  }

  &-line {
    z-index: -1;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
  }

  &-icons {
    border-radius: 4px;
    border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
    background: var(--Colors-Background-bg-action-secondary, #fff);
    box-shadow: $box-shadow;
    transition: all 0.15s ease;
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
