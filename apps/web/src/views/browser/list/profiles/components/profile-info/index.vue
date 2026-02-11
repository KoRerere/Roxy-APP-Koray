<script lang="tsx" setup>
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'
import ProxyTooltip from './proxy-tooltip.vue'
import AccountTooltip from './account-tooltip.vue'
import RxButton from '/@/components/rx-button'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import AccountCreate from '/@/views/account/create/quick.vue'
import AccountEdit from '/@/views/account/create/batch-edit.vue'
import AccountList from '/@/views/account/list/quick.vue'
import CanvasLine from './canvas-line.vue'
import { RxSvgIcon } from '/@/components/rx-icon'

import { useRoleStore } from '/@/stores/role'
import { createDefaultObject, formatProxyTime, isLikeFunction, strConcat } from '/@/utils'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useDrawer } from '/@/hooks/useDrawer'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useConfirm } from 'primevue/useconfirm'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'

import { API } from '/@/api'
import { BuyEntryType, BuyProxyListType, ProfileModifyType, ProxyCheckStatus, ProxyType } from '/@/enums'
import { clearProxyKeys, silentUpdateAccount, silentUpdateProxy } from '../util'

interface Props {
  workspaceName?: string
  data: Record<string, any>
  openMessage?: Record<string, any>
  showSort?: boolean
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
  filterKeys = ['os', 'proxy', 'account'],
} = defineProps<Props>()

const emits = defineEmits(['refresh'])

const OS_ICON: any = {
  windows: 'platforms/rx_os_windows',
  linux: 'platforms/rx_os_linux',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const router = useRouter()
const confirm = useConfirm()
const drawerInstance = useDrawer()
const role = useRoleStore()
const { showMenu: showPopupMenu } = usePopupMenu()
const [showToast, onlyErrorToast] = useResponseToast()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const { buyProxy } = useProxy()

const proxyCss = useCssModule('proxy')
const proxyProvider = ref()
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
        coreVersion: data.coreVersion,
      }),
    },
    {
      key: 'proxy',
      classes: proxyClass,
      svg: hasProxy.value ? `country-code/${data.lastCountry}` : data.lastIp ? 'base/rx_ic_route2' : 'base/rx_ic_plus',
      svgColor: 'var(--colors-icon-icon-tertiary)',
      data: {
        hasProxy: hasProxy.value,
        // 最近一次检测的代理 IP 信息
        lastCountry: data.lastCountry || '--',
        lastCity: strConcat('/', data.lastCity) || '',
        lastIp: data.lastIp || '--',
        checkTime: data.checkTime ? formatProxyTime(data.checkTime) : '--',
        // 上一次检测的代理 IP 信息
        beforeCountry: data.beforeProxyInfo?.beforeCountry || '--',
        beforeCity: strConcat('/', data.beforeProxyInfo?.beforeCity) || '',
        beforeIp: data.beforeProxyInfo?.beforeIp || '--',
        beforeTime: data.beforeProxyInfo?.beforeTime ? formatProxyTime(data.beforeProxyInfo?.beforeTime) : '--',
      },
    },
    {
      key: 'account',
      svg: windowPlatformList[0] ? 'base/rx_ic_user_key' : 'base/rx_ic_plus',
      svgColor: windowPlatformList[0] ? 'var(--colors-icon-icon-tertiary)' : 'var(--colors-icon-icon-secondary)',
      showSub: windowPlatformList.length > 1,
      platformAccount: windowPlatformList[0],
      subPlatformAccount: windowPlatformList.length > 2 ? undefined : windowPlatformList[1],
      data: windowPlatformList,
    },
  ].filter(item => filterKeys.includes(item.key))
})

function onClick(event: MouseEvent, key: string) {
  if (disabled || readonly)
    return

  switch (key) {
    case 'proxy': {
      const model = getProxyModel()
      if (model.every(item => !item.visible))
        return
      showPopupMenu(event, { model })
      break
    }
    case 'account': {
      const model = getAccountModel()
      if (model.every(item => !item.visible))
        return
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
        .map(key => [key, data[key]]),
    ),
  }

  return [
    {
      label: $t('添加代理 IP'),
      icon: 'base/rx_ic_plus',
      visible: !hasProxy.value && !role.isViewer,
      command: () => {
        createProxy()
      },
    },
    {
      label: $t('选择已有代理 IP'),
      icon: 'base/rx_ic_exchange',
      visible: !hasProxy.value && !role.isViewer,
      command: () => {
        openProxyDrawer(proxyData)
      },
    },
    {
      label: $t('测试代理 IP'),
      icon: 'base/rx_ic_speed_test',
      visible: hasProxy.value,
      command: async () => {
        if (!globalThis.isElectron) {
          return globalThis.electronAPI.send('proxy:detect', {} as any)
        }

        const checkRes = await checkProxy(toRaw(data))
        batchTestShowToast(checkRes)
        if (data.moduleId && data.buyProxyType === ProxyType.resource) {
          API.proxy.userMdfProxyModuleCreate([{ id: data.moduleId, ...checkRes }] as any)
        }
        if (checkRes.checkStatus === ProxyCheckStatus.success) {
          updateProfile({ id: data.id, dirId: data.dirId, ...checkRes }, {
            success: () => silentUpdateProxy(data, checkRes),
          })
        }
      },
    },
    {
      label: $t('刷新代理 IP'),
      icon: 'base/rx_ic_refresh',
      visible: hasProxy.value,
      disabled: !data.refreshUrl,
      command: async () => {
        const isOK = await globalThis.electronAPI.send('proxy:refreshUrl', data.refreshUrl)
        showToast(isOK ? 0 : -1, data.refreshUrl)
      },
    },
    {
      visible: hasProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('编辑代理 IP'),
      icon: 'base/rx_ic_edit',
      visible: data.buyProxyType === ProxyType.resource && hasProxy.value && !role.isViewer,
      command: () => {
        if (data.isEncryptProxy) {
          showToast(-1, $t('该代理 IP 已加密无法编辑，如需更换，请先删除此代理 IP 或选择其他代理 IP'))
          return
        }
        createProxy(proxyData)
      },
    },
    {
      label: $t('选择已有代理 IP'),
      icon: 'base/rx_ic_exchange',
      visible: hasProxy.value && !role.isViewer,
      command: () => {
        openProxyDrawer(proxyData)
      },
    },
    {
      visible: role.isOwner,
      separator: true,
    },
    {
      label: $t('购买代理 IP'),
      icon: 'base/rx_ic_cart',
      visible: role.isOwner,
      command: async () => {
        if (!proxyProvider.value) {
          const { code, data, msg } = await API.proxy.userGetProxyStoreListList()
          onlyErrorToast(code, msg)
          if (code !== 0)
            return
          proxyProvider.value = data.find((item: any) => item.proxyProviderName === 'RoxyBrowser')
        }

        const provider = {
          proxyProviderWebsite: proxyProvider.value.proxyProviderWebsite,
          proxyTypeList: proxyProvider.value.proxyTypeList,
          proxyProviderIcon: proxyProvider.value.proxyProviderIcon,
          proxyProviderName: proxyProvider.value.proxyProviderName,
        }

        try {
          const orderInfo = await buyProxy({ provider, entryType: BuyEntryType.Immediate })

          if (!orderInfo?.immediate) {
            router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
            return
          }

          showToast(0, $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

          const { code, data } = await API.proxy.userGetUserBuyProxyListList({ orderNo: orderInfo?.orderNo, type: BuyProxyListType.Use } as any)
          if (code !== 0 || !data.rows?.[0]) {
            return
          }

          setChooseProxy(data.rows[0])
        }
        catch (error) { }
      },
      render: (props: any) => {
        return (
          <RxButton class="!w-full !justify-start" severity="secondary" text pt={props['btn-pt']}>
            {{
              default: () => (
                <div class="flex items-center gap-2">
                  <RxSvgIcon name={props.item.icon} color="var(--colors-icon-icon-secondary)"></RxSvgIcon>
                  <span class="p-button-label">{props.item.label}</span>
                  <div class={`${proxyCss.dot}`}></div>
                </div>
              ),
            }}
          </RxButton>
        )
      },
    },
    {
      visible: hasProxy.value && !role.isViewer,
      separator: true,
    },
    {
      label: $t('删除代理 IP'),
      icon: 'base/rx_ic_bin_1',
      visible: hasProxy.value && !role.isViewer,
      command: () => {
        confirm.require({
          header: $t('删除代理 IP'),
          message: $t('您确认要删除代理 IP 吗？'),
          rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
          acceptProps: { label: $t('确认'), severity: 'danger' },
          accept: async () => {
            const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ ids: [data.id], type: ProfileModifyType.ProxyDelete })
            onlyErrorToast(code, msg)
            if (code === 0) {
              const params = {
                moduleId: 0, // 为 0 表示解除关联
                proxyCategory: 'noproxy',
                proxyMethod: 'custom',
                buyProxyType: ProxyType.resource,
                checkStatus: ProxyCheckStatus.none,
                ...createDefaultObject(clearProxyKeys, ''),
              }
              if (!data.openTime) {
                Reflect.set(params, 'lastIp', '')
              }
              else {
                Reflect.deleteProperty(params, 'lastIp')
              }
              silentUpdateProxy(data, params, ['isEncryptProxy', 'proxyEncryptInfo'])
            }
          },
        })
      },
    },
  ]
}

function getAccountModel() {
  return [
    {
      label: $t('编辑账号'),
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
                    windowPlatformList,
                  },
                })
                drawerInstance.hideDrawer()
                onlyErrorToast(code, msg)
                if (code === 0) {
                  silentUpdateAccount(data, windowPlatformList)
                }
              },
            }),
          },
        })
      },
    },
    {
      separator: true,
      visible: !role.isViewer && data.windowPlatformList.length > 0,
    },
    {
      label: $t('添加账号'),
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
                  _tempId: Date.now().toString(32),
                })
                await updateProfile({ id, dirId, windowPlatformList: _windowPlatformList }, {
                  success: () => {
                    silentUpdateAccount(data, _windowPlatformList)
                  },
                })
              },
            }),
          },
        })
      },
    },
    {
      label: $t('选择账号'),
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
                  },
                })
              },
            }),
          },
        })
      },
    },
  ]
}

function createProxy(proxyData?: Record<string, any>) {
  drawerInstance.showDrawer({
    title: proxyData
      ? $t('为[{workspaceName}-{uid}]编辑代理 IP', { workspaceName, uid: data.windowSortNum })
      : $t('为[{workspaceName}-{uid}]添加代理 IP', { workspaceName, uid: data.windowSortNum }),
    dismissable: false,
    slots: {
      container: () => h(ProxyCreate, {
        data: proxyData,
        onConfirm: (formData: any) => {
          const { id, dirId } = data
          const params = { ...formData, id, dirId, moduleId: 0, proxyMethod: 'custom' }
          updateProfile(params, {
            success: () => silentUpdateProxy(data, params, ['isEncryptProxy', 'proxyEncryptInfo']),
          })
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

function openProxyDrawer(proxyData: Record<string, any>) {
  drawerInstance.showDrawer({
    title: $t('为[{workspaceName}-{uid}]选择代理 IP', { workspaceName, uid: data.windowSortNum }),
    dismissable: false,
    slots: {
      container: () => h(ProxyQuick, {
        data: proxyData,
        onConfirm: (formData: any) => {
          setChooseProxy(formData)
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

function setChooseProxy(formData: any) {
  const { id: moduleId, proxyCategory, protocol, proxyType, ...rest } = formData
  const { id, dirId } = data
  updateProfile({ id, dirId, moduleId, proxyMethod: 'choose' }, {
    success: () => silentUpdateProxy(data, {
      ...rest,
      moduleId,
      protocol,
      proxyCategory: proxyCategory || protocol,
      proxyMethod: 'choose',
      buyProxyType: proxyType ?? ProxyType.resource,
    }, ['isEncryptProxy', 'proxyEncryptInfo']),
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
  }
  else {
    isLikeFunction(fallback) && fallback()
  }
}
</script>

<template>
  <div class="position-relative flex h-full items-center profile" :class="{ 'disabled-mask': disabled }">
    <div v-if="showSort">
      <span class="profile-name">{{ workspaceName }}-</span>
      <span class="profile-num">{{ `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0') }}</span>
    </div>
    <div class="position-relative flex justify-between state" :class="{ 'w-[136px]': list.length > 1 }">
      <div v-for="item in list" :key="item.key" class="relative" @click.stop="onClick($event, item.key)">
        <template v-if="item.key === 'os'">
          <div v-tooltip.top="{ value: item.tooltip, showDelay: 500 }" class="relative flex-cc cursor-pointer pa-1 state-icons" :class="item.classes">
            <RxSvgIcon class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="item.svg" :color="item.svgColor" />
          </div>
        </template>

        <template v-else-if="item.key === 'proxy'">
          <RxTooltip>
            <template #default="{ hide }">
              <div class="relative flex-cc cursor-pointer pa-1 state-icons" :class="item.classes" @click="hide">
                <RxSvgIcon class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="item.svg" :color="item.svgColor" />
              </div>
            </template>
            <template v-if="item.data?.lastIp !== '--'" #content>
              <ProxyTooltip v-bind="item.data" />
            </template>
          </RxTooltip>
        </template>

        <template v-else-if="item.key === 'account'">
          <RxTooltip>
            <template #default="{ hide }">
              <div @click="hide">
                <div class="relative flex-cc cursor-pointer pa-1 state-icons" :class="item.classes">
                  <PlatformIcon v-if="item.platformAccount?.platformIcon" :platform-icon="item.platformAccount.platformIcon" :platform-icon-dark="item.platformAccount.platformIconDark"
                                class="block w-4 h-4 pointer-events-none"
                  />
                  <RxSvgIcon v-else class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="item.svg" :color="item.svgColor" />
                </div>
                <div v-if="item.showSub" class="absolute top-0.5 right-0 -translate-y-1/2 translate-1/2 flex-cc cursor-pointer pa-0.5 state-icons" :class="item.classes">
                  <PlatformIcon v-if="item.subPlatformAccount?.platformIcon" :platform-icon="item.subPlatformAccount.platformIcon" :platform-icon-dark="item.subPlatformAccount.platformIconDark"
                                class="block w-3 h-3 pointer-events-none"
                  />
                  <RxSvgIcon v-else class="w-3 h-3 pointer-events-none" fallback="base/rx_ic_earth" name="base/rx_ic_more-h" :color="item.svgColor" />
                </div>
              </div>
            </template>
            <template v-if="item.data?.length > 0" #content>
              <AccountTooltip :platform-list="item.data" />
            </template>
          </RxTooltip>
        </template>
      </div>
      <div v-if="list.length > 1" class="state-line">
        <CanvasLine v-if="isOpenBrowser" :wave-width="1.2" :blur="0" speed="fast" :wave-opacity="1" />
        <RxDivider v-else class="!w-25" line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
      </div>
    </div>
  </div>
</template>

<style module="proxy">
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--colors-background-bg-error);
}
</style>

<style lang="scss" scoped>
$box-shadow:
  0px 4px 4px -1px rgba(0, 0, 0, 0.02),
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
    color: var(--colors-text-text-tertiary, #575d60);
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
    border: 0.5px solid var(--colors-border-border-action);
    background: var(--colors-background-bg-action);
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
  background: var(--colors-background-bg-page);
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
    border: 1px solid var(--pattern-profiles-input-border);
    background: var(--pattern-profiles-input-bg);
  }
}

.window-name-input {
  font-size: 12px;
  border-radius: 4px;
  box-shadow: none !important;
  line-height: 16px;
  padding: 4px 8px;
  width: 160px;
}
</style>
