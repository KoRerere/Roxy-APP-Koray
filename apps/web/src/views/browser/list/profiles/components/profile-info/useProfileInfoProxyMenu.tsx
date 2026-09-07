import { toRaw, unref } from 'vue'
import type { ComputedRef, MaybeRef } from 'vue'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import { ProxyType } from '/@/enums'
import { notifyProxyModuleSpeedTest, persistProfileRowAfterProxySpeedTest, usePurchaseOfficialProxy } from '../../hooks/useProfileProxy'
import { silentUpdateProxy } from '/@/views/browser/list/profiles/components/util'

type CheckProxyFn = ReturnType<typeof import('/@/views/agent/hooks')['useCheckProxy']>['testProxy']
type BatchTestShowToastFn = ReturnType<typeof import('/@/views/agent/hooks')['useCheckProxy']>['batchTestShowToast']
type BuildProxyDataFn = (profile: Record<string, any>) => Record<string, any>
type ConfirmDeleteProxyFn = (origin: Record<string, any>) => void

export function useProfileInfoProxyMenu(options: {
  data: MaybeRef<Record<string, any>>
  hasProxy: ComputedRef<boolean>
  buildProxyData: BuildProxyDataFn
  confirmDeleteProxy: ConfirmDeleteProxyFn
  check: (key: string) => boolean
  showToast: (code: number, ...rest: any[]) => void
  onlyErrorToast: (code: number, msg: string) => void
  checkProxy: CheckProxyFn
  batchTestShowToast: BatchTestShowToastFn
  openAddProxy: () => void | Promise<void>
  editProxy: (proxyData: Record<string, any>) => Promise<void>
  openProxyDrawer: (proxyData: Record<string, any>) => Promise<void>
  setChooseProxy: (formData: any) => void
  saveLocalTrack: (name: string | undefined) => void
  proxyCss: Record<string, string>
}) {
  const {
    data,
    hasProxy,
    buildProxyData,
    confirmDeleteProxy,
    check,
    showToast,
    onlyErrorToast,
    checkProxy,
    batchTestShowToast,
    openAddProxy,
    editProxy,
    openProxyDrawer,
    setChooseProxy,
    saveLocalTrack,
    proxyCss,
  } = options

  const { purchaseImmediateOfficialProxy } = usePurchaseOfficialProxy()

  function getProxyModel() {
    const row = unref(data)
    const proxyData = buildProxyData(row)

    return [
      {
        name: 'addProxy',
        label: $t('添加代理 IP'),
        icon: 'base/rx_ic_plus',
        visible: !hasProxy.value && check('Profiles_add_proxy_outside'),
        command: async () => {
          await openAddProxy()
        },
      },
      {
        name: 'chooseProxy',
        label: $t('选择已有代理 IP'),
        icon: 'base/rx_ic_exchange',
        visible: !hasProxy.value && check('Profiles_select_proxy'),
        command: async () => {
          await openProxyDrawer(proxyData)
        },
      },
      {
        name: 'checkProxy',
        label: $t('测试代理 IP'),
        icon: 'base/rx_ic_speed_test',
        visible: hasProxy.value && check('Profiles_speed_test_proxy'),
        command: async () => {
          if (!globalThis.isElectron) {
            return globalThis.electronAPI.send('proxy:detect', {} as any)
          }
          const runCheck = async () => {
            Reflect.deleteProperty(row, '_checkRes')
            const checkRes = await checkProxy(toRaw(row))
            Reflect.set(row, '_checkRes', toRaw(checkRes))
            silentUpdateProxy(row, checkRes, { replaceProxy: false })
            batchTestShowToast({ ...checkRes, proxyType: row.buyProxyType }, { reCheck: runCheck })
            if (row.moduleId && row.buyProxyType === ProxyType.resource) {
              notifyProxyModuleSpeedTest([{ id: row.moduleId, ...checkRes }])
            }
            await persistProfileRowAfterProxySpeedTest([{ item: row, checkRes }], { onlyErrorToast })
          }
          await runCheck()
        },
      },
      {
        name: 'refreshProxy',
        label: $t('刷新代理 IP'),
        icon: 'base/rx_ic_refresh',
        visible: hasProxy.value && check('Profiles_refresh_url'),
        disabled: !row.refreshUrl,
        command: async () => {
          const isOK = await globalThis.electronAPI.send('proxy:refreshUrl', row.refreshUrl)
          showToast(isOK ? 0 : -1, row.refreshUrl)
        },
      },
      {
        visible: hasProxy.value && check('Profiles_edit_proxy_outside'),
        separator: true,
      },
      {
        name: 'editProxy',
        label: $t('编辑代理 IP'),
        icon: 'base/rx_ic_edit',
        visible: row.buyProxyType === ProxyType.resource && hasProxy.value && check('Profiles_edit_proxy_outside'),
        command: async () => {
          if (row.isEncryptProxy) {
            showToast(-1, $t('该代理 IP 已加密无法编辑，如需更换，请先删除此代理 IP 或选择其他代理 IP'))
            return
          }
          await editProxy(proxyData)
        },
      },
      {
        name: 'chooseProxy',
        label: $t('选择已有代理 IP'),
        icon: 'base/rx_ic_exchange',
        visible: hasProxy.value && check('Profiles_select_proxy'),
        command: async () => {
          await openProxyDrawer(proxyData)
        },
      },
      {
        visible: check('Cost_Center_all'),
        separator: true,
      },
      {
        name: 'buyProxy',
        label: $t('购买代理 IP'),
        icon: 'base/rx_ic_cart',
        visible: check('Cost_Center_all'),
        command: async () => {
          const proxy = await purchaseImmediateOfficialProxy()
          if (proxy) {
            setChooseProxy(proxy)
          }
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
        visible: hasProxy.value && check('Profiles_delete_proxy_outside'),
        separator: true,
      },
      {
        name: 'deleteProxy',
        label: $t('删除代理 IP'),
        icon: 'base/rx_ic_bin_1',
        visible: hasProxy.value && check('Profiles_delete_proxy_outside'),
        command: () => {
          confirmDeleteProxy(row)
        },
      },
    ].map((item: any) => {
      if (typeof item.command === 'function') {
        const original = item.command

        item.command = async () => {
          saveLocalTrack(item.name)
          return await original()
        }
      }

      return item
    })
  }

  return { getProxyModel }
}
