<script lang="ts" setup>
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'
import ProxyTooltip from './proxy-tooltip.vue'
import AccountTooltip from './account-tooltip.vue'
import CanvasLine from './canvas-line.vue'
import Earth from './earth.vue'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useDrawer } from '/@/hooks/useDrawer'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useTrack } from '/@/views/browser/list/profiles/hooks/useOperationTrack'
import { PROXY_BUY_ADD_DRAWER_KEY, useProfileProxy } from '../../hooks/useProfileProxy'
import { usePermission } from '/@/hooks/usePermission'
import { useProfileInfoAccountMenu } from './useProfileInfoAccountMenu'
import { useProfileInfoList } from './useProfileInfoList'
import { useProfileInfoMutations } from './useProfileInfoMutations'
import { useProfileInfoProxyMenu } from './useProfileInfoProxyMenu'

interface ProfileInfoProps {
  workspaceName?: string
  data: Record<string, any>
  openMessage?: Record<string, any>
  showSort?: boolean
  disabled?: boolean
  readonly?: boolean
  filterKeys?: string[]
}

const props = withDefaults(defineProps<ProfileInfoProps>(), {
  showSort: true,
  disabled: false,
  readonly: false,
  filterKeys: () => ['os', 'proxy', 'account'],
})

const emits = defineEmits(['refresh'])

const {
  workspaceName,
  data,
  showSort,
  disabled,
  readonly,
} = props

const drawerInstance = useDrawer()
const { showMenu: showPopupMenu } = usePopupMenu()
const [showToast, onlyErrorToast] = useResponseToast()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const { buildProxyData, confirmDeleteProxy } = useProfileProxy()
const { saveLocalTrack } = useTrack()
const { check } = usePermission()
const proxyBuyAddDrawer = inject(PROXY_BUY_ADD_DRAWER_KEY, null)

const proxyCss = useCssModule('proxy')

const { hasProxy, isOpenBrowser, list } = useProfileInfoList(
  toRef(props, 'data'),
  toRef(props, 'openMessage'),
  toRef(props, 'filterKeys'),
)

const { updateProfile, setChooseProxy, addCustomProxy, editProxy, openProxyDrawer } = useProfileInfoMutations({
  data: toRef(props, 'data'),
  workspaceName: toRef(props, 'workspaceName'),
  drawerInstance,
  emit: emits,
  onlyErrorToast,
})

async function openAddProxy() {
  await proxyBuyAddDrawer?.openProxyBuyAddDrawer({
    onBuySuccess: proxy => setChooseProxy(proxy),
    onAddConfirm: formData => addCustomProxy(formData),
  })
}

const { getProxyModel } = useProfileInfoProxyMenu({
  data: toRef(props, 'data'),
  hasProxy,
  buildProxyData,
  confirmDeleteProxy,
  check,
  showToast: showToast as (code: number, ...rest: any[]) => void,
  onlyErrorToast,
  checkProxy,
  batchTestShowToast,
  openAddProxy,
  editProxy,
  openProxyDrawer,
  setChooseProxy,
  saveLocalTrack,
  proxyCss,
})

const { getAccountModel } = useProfileInfoAccountMenu({
  data: toRef(props, 'data'),
  workspaceName: toRef(props, 'workspaceName'),
  drawerInstance,
  onlyErrorToast,
  check,
  updateProfile,
  saveLocalTrack,
})

const isCheckingProxy = computed(() => data.loadingOperationMap?.checkProxy)

function openMenus(event: MouseEvent, key: string) {
  if (disabled || readonly)
    return

  switch (key) {
    case 'proxy': {
      const model = getProxyModel()
      if (model.every(item => !item.visible) || isCheckingProxy.value)
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
</script>

<template>
  <div class="position-relative flex h-full items-center gap-3" :class="{ grayscale: disabled }">
    <div v-if="showSort" class="font-[JetBrains_Mono] text-3 font-500 leading-4">
      <span class="tt-tertiary">{{ workspaceName }}-</span>
      <span class="tt-primary">{{ `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0') }}</span>
    </div>
    <div class="position-relative flex justify-between state" :class="{ 'w-34': list.length > 1 }">
      <div v-for="item in list" :key="item.key" class="relative" @click.stop="openMenus($event, item.key)">
        <template v-if="item.key === 'os'">
          <div v-tooltip.top="{ value: item.tooltip, showDelay: 500 }" class="relative flex-cc cursor-pointer pa-1 state-icons" :class="item.classes">
            <SvgIcon class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="(item.svg as any)" :color="item.svgColor" />
          </div>
        </template>

        <template v-else-if="item.key === 'proxy'">
          <RxTooltip>
            <template #default="{ hide }">
              <div class="relative flex-cc cursor-pointer pa-1 state-icons" :class="[item.classes, { checking: isCheckingProxy }]" @click="hide">
                <Earth v-if="isCheckingProxy" :size="16" color="var(--colors-icon-icon-inactive)" />
                <SvgIcon v-else class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="(item.svg as any)" :color="item.checkedColor || item.svgColor" />
                <div v-if="item.checkedColor" class="absolute -top-1 -right-1 w-2 h-2 rounded-full" :style="{ background: item.checkedColor }" />
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
                  <SvgIcon v-else class="w-4 h-4 pointer-events-none" fallback="base/rx_ic_earth" :name="(item.svg as any)" :color="item.svgColor" />
                </div>
                <div v-if="item.showSub" class="absolute top-0.5 right-0 -translate-y-1/2 translate-1/2 flex-cc cursor-pointer pa-0.5 state-icons" :class="item.classes">
                  <PlatformIcon v-if="item.subPlatformAccount?.platformIcon" :platform-icon="item.subPlatformAccount.platformIcon" :platform-icon-dark="item.subPlatformAccount.platformIconDark"
                                class="block w-3 h-3 pointer-events-none"
                  />
                  <SvgIcon v-else class="w-3 h-3 pointer-events-none" fallback="base/rx_ic_earth" name="base/rx_ic_more-h" :color="item.svgColor" />
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
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    transition: all 0.15s ease;

    &.checking {
      background: var(--colors-background-bg-action-inactive);
    }
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
</style>
