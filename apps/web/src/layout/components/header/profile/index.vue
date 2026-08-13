<script setup lang="tsx">
import RxAvatar from '/@/components/rx-avatar'
import RedeemCodeModal from '/@/views/pay/wallet/components/redeem-code-modal.vue'
import RedeemCodeRecord from '/@/layout/components/header/profile/components/record.vue'
import SettingsPopup from './components/settings-popup.vue'
import BasicInfo from '/@/layout/components/header/profile/components/workspace/basic-info.vue'
import WorkspaceList from '/@/layout/components/header/profile/components/workspace/list.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useDialog } from 'primevue/usedialog'
import { useDialog as useDialogHook } from '/@/hooks/useDialog'
import { API } from '/@/api'
import { ISO639List } from '/@/constants/iso-639'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { showPageLoading } from '/@/utils'
import { getSettings } from './components/settings-popup'
import { useIdentityVerificationEntry } from './components/settings-popup/identity-verification-entry'
import { getColorSchemeList, useThemeStore } from '/@/stores/theme'
import { useEmitterEvent } from '/@/utils/eventBus'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { usePreventMask } from '/@/hooks/usePreventMask'
import type { SvgNames } from '/@/components/rx-icon'
import { getWorkspaceAvatarProps } from '/@/utils/workspace'
import { useLockApp } from '/@/layout/components/header/useLockApp'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

const router = useRouter()
const dialog = useDialog()
const userStore = useUserStore()
const simpleLocale = useSimpleLocale()
const themeStore = useThemeStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { planSuccess } = usePay()
const [showModal] = useDialogHook()
const [showToast] = useResponseToast()
const { showPreventMask, hidePreventMask } = usePreventMask()
const { openLockApp } = useLockApp()
const { openIdentityVerificationEntry } = useIdentityVerificationEntry()
const profileLabels = useProfileEntityLabels()

const menuRef = useTemplateRef('menu')

const avatarProps = computed(() => {
  const { workspacePicture, workspaceName } = currentWorkspace.value || {}
  return getWorkspaceAvatarProps({
    workspacePicture,
    workspaceName,
    size: 26,
    emojiFontSize: 18,
    textFontSize: 14,
  })
})

const items = computed(() => {
  return [
    {
      label: $t('兑换'),
      icon: 'base/rx_ic_medal',
      command: openRedeemCode,
    },
    {
      label: $t('我的兑换码'),
      icon: 'base/rx_ic_red-envelope',
      render: ({ item }: any) => {
        return (
          <div class="flex items-center gap-2 w-full">
            <RxSvgIcon name={item.icon as SvgNames} color="var(--colors-icon-icon-secondary)" />
            <span class="tt-primary text-3.25 leading-4">{item.label}</span>
          </div>
        )
      },
      command: openMyRedeemCodeList,
    },
    {
      separator: true,
    },
    ...getSettings().map(item => ({
      ...item,
      command: () => openSettings(item.name),
    })),
    {
      label: $t('应用锁'),
      name: 'lockApp',
      icon: 'base/rx_ic_unlock2',
      command: openLockApp,
    },
    {
      separator: true,
    },
    {
      label: $t('语言'),
      icon: 'base/rx_ic_language',
      items: ISO639List.map((item) => {
        return {
          ...item,
          isCheck: () => simpleLocale.currentLocale === item.locale,
          command: async () => {
            simpleLocale.setSimpleLocale(item.locale)
            globalThis.electronAPI.send('app:saveSoftConfig', { language: item.locale } as never)
          },
        }
      }),
    },
    {
      label: $t('主题模式'),
      icon: 'base/rx_ic_contrast',
      items: getColorSchemeList().map((item) => {
        return {
          ...item,
          isCheck: () => themeStore.theme === item.value,
          command: async () => {
            themeStore.setTheme(item.value as any)
            // 如果用户是第一次切换主题，则弹出提示框
            if (userStore.userConfig?.isFirstSwitchTheme) {
              showModal({
                header: $t('主题模式设置'),
                class: '!w-[480px]',
                okText: $t('前往'),
                slots: {
                  default: () => <>{profileLabels.value.themeEntitySettingsNote}</>,
                },
                async handleOk() {
                  openSettings('preferences')
                },
                async handleCancel() {
                  await API.base.userSetUserConfigCreate({ isFirstSwitchTheme: false })
                  userStore.updateUserConfig()
                },
              })
            }
          },
        }
      }),
    },
    {
      separator: true,
    },
    {
      label: '图标(仅开发)',
      icon: 'base/rx_ic_outlink',
      vIf: () => import.meta.hot,
      command: () => {
        window.open('/figma-icons')
      },
    },
    {
      label: '多语言(仅开发)',
      icon: 'base/rx_ic_outlink',
      vIf: () => import.meta.hot,
      command: () => {
        window.open('/__language-localization__')
      },
    },
    {
      label: '实验室(仅开发)',
      icon: 'base/rx_ic_doc_api',
      vIf: () => import.meta.hot,
      command: () => {
        router.push({ name: 'roxy-lab' })
      },
    },
    {
      label: $t('退出登录'),
      icon: 'base/rx_ic_logout',
      command: async () => {
        const result = await globalThis.electronAPI.send('browser:getOpenedBrowser')
        if (result?.length > 0) {
          const isConfirm = await showLogoutConfirm()
          if (!isConfirm)
            return
        }
        showPageLoading()
        // 1) 先同步窗口数据并关闭浏览器(此时 token 仍有效, 主进程会显示同步进度遮罩),
        //    同步真正完成后才继续, 避免"数据没同步完就跳到登录页".
        await globalThis.electronAPI.send('user:logout').catch((error) => {
          console.warn('logout window sync failed (ignored):', error)
        })
        // 2) 同步完成后再调用服务端登出接口, 避免提前失效 token 导致上一步数据同步失败.
        await API.base.userLogoutList().catch(() => { })
        await globalThis.electronAPI.send('mcp:close')
        // 3) 仅清理本地登录态(浏览器已在上面关闭), 再跳转登录页.
        userStore.clearUserInfo({ skipServerSync: true })
        router.push({ name: 'login' })
      },
    },
  ].filter(item => !item.vIf || item.vIf())
})

useEmitterEvent('openSettings', ({ settingsKey, anchorPoint }) => {
  openSettings(settingsKey, anchorPoint)
})

useEmitterEvent('openIdentityVerification', (options) => {
  void openIdentityVerificationEntry(options)
})

function openRedeemCode() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <RedeemCodeModal
          onClose={hideModal}
          onConfirm={
            async (redeemCode: string) => {
              const { code, msg } = await API.pay.userRedeemWindowCodeCreate({ code: redeemCode })
              showToast(code, msg)
              if (code !== 0)
                return
              planSuccess(true)
              hideModal()
            }
          }
        >
        </RedeemCodeModal>
      ),
    },
  })
}

function openMyRedeemCodeList() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <RedeemCodeRecord onClose={hideModal}></RedeemCodeRecord>,
    },
  })
}

function showLogoutConfirm() {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  showModal({
    header: $t('提示'),
    class: '!w-[380px]',
    okText: $t('继续'),
    okProps: {
      severity: 'danger',
    },
    slots: {
      default: () => <>{profileLabels.value.closeAllEntitiesOnExit}</>,
    },
    handleOk() {
      resolve(true)
    },
    handleCancel() {
      resolve(false)
    },
  })
  return promise
}

function openSettings(activeKey: string, anchorPoint?: string) {
  dialog.open(SettingsPopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      dismissableMask: true,
      style: {
        width: 'var(--width-1_5xl, 960px)',
        height: '640px',
      },
      pt: { content: '!pa-0 !overflow-y-hidden' },
    },
    data: {
      props: {
        activeKey,
        anchorPoint,
      },
    },
  })
}

function toggle(event: Event) {
  menuRef.value?.toggle(event)
  userStore.fetchUserInfo()
}

function hideMenu() {
  menuRef.value?.hide()
}
</script>

<template>
  <div class="flex items-center pr-1.5 pl-1 py-0.5 gap-1.5 select-none cursor-pointer rounded-1 settings" @click="toggle">
    <RxAvatar v-bind="avatarProps" />
    <div class="tt-primary text-3.25 font-600 leading-4">
      {{ currentWorkspace?.workspaceName }}
    </div>
    <RxSvgIcon class="cursor-pointer pointer-events-none" name="base/rx_ic_chevron_down" :size="12" />
  </div>

  <TieredMenu ref="menu" :model="items" popup :pt="{ root: '!border-0.5 max-w-80 min-w-60' }" @hide="hidePreventMask" @show="showPreventMask">
    <template #start>
      <div class="flex flex-col gap-1 pa-1">
        <BasicInfo />
        <RxDivider line-only line-color="var(--tieredmenu-separator-border-color)" />
        <WorkspaceList @hide="hideMenu" />
        <RxDivider line-only line-color="var(--tieredmenu-separator-border-color)" />
      </div>
    </template>
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <component :is="item.render" v-if="item.render" :item="item" />
        <template v-else>
          <RxSvgIcon :name="(item.icon as SvgNames)" color="var(--colors-icon-icon-secondary)" />
          <span class="tt-primary text-3.25 leading-4">{{ item.label }}</span>
          <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
          <RxSvgIcon v-if="item.isCheck?.()" class="ml-auto" name="base/rx_ic_check" />
        </template>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" scoped>
.settings {
  &:not(:disabled):hover {
    background: var(--colors-background-bg-action-hover);

    svg {
      color: var(--colors-text-text-primary);
    }
  }
}
</style>
