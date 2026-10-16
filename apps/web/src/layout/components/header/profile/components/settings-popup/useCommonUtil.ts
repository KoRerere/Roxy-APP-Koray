import { API } from '/@/api'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { $t } from '/@/locales'
import { useCheckProxy } from '/@/views/agent/hooks'
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'
import type { ProxyDetectionParams } from '#roxybrowser/utils/proxyDetection'

const DEFAULT_PROXY_HOST = '127.0.0.1'

function buildLocalConfig(item: Items) {
  const formatted = item.formatValue?.(item) ?? item.value
  if (item.formatValue && formatted && typeof formatted === 'object' && !Array.isArray(formatted)) {
    return formatted as Record<string, unknown>
  }
  return { [item.name as string]: isProxy(formatted) ? toRaw(formatted) : formatted }
}

function normalizeHostPortValue(value: unknown) {
  if (!Array.isArray(value)) {
    return { host: '', port: '' }
  }
  const [host, port] = value
  return {
    host: (host ?? '').toString().trim(),
    port: port != null && port !== '' ? String(port) : '',
  }
}

function buildCustomProxyCheckParams(
  settingsModule: SettingsModule,
  softConfig?: Record<string, any>,
): Partial<ProxyDetectionParams> {
  const allItems = settingsModule.list.flatMap(section => section.items)
  const getItem = (name: string) => allItems.find(i => i.name === name)

  const hostPortItem = getItem('proxyHostPort')
  const { host: hostFromItem, port: portFromItem } = normalizeHostPortValue(toRaw(hostPortItem?.value))

  const host = (hostFromItem || softConfig?.proxyHost || DEFAULT_PROXY_HOST).toString().trim()
  const portNum = Number(portFromItem || softConfig?.proxyPort)
  const port = Number.isFinite(portNum) && portNum >= 1 && portNum <= 65535 ? String(portNum) : ''

  let proxyCategory = getItem('proxyProtocol')?.value ?? softConfig?.proxyProtocol
  if (proxyCategory && typeof proxyCategory === 'object' && 'value' in proxyCategory) {
    proxyCategory = proxyCategory.value
  }

  return {
    host,
    port,
    proxyCategory: proxyCategory || 'SOCKS5',
    proxyUserName: getItem('proxyUsername')?.value ?? softConfig?.proxyUsername ?? '',
    proxyPassword: getItem('proxyPassword')?.value ?? softConfig?.proxyPassword ?? '',
    systemProxySwitch: false,
    outerParamFirst: true,
  }
}

function isValidCustomProxyParams(params: Partial<ProxyDetectionParams>) {
  const host = params.host?.toString().trim()
  const port = Number(params.port)
  return Boolean(host) && Number.isFinite(port) && port >= 1 && port <= 65535
}

export function useCommonUtil() {
  const [showFormDialog] = useFormDialog()
  const [showToast, onlyErrorToast] = useResponseToast()
  const { testProxy, batchTestShowToast } = useCheckProxy()
  const simpleLocale = useSimpleLocale()
  const userStore = useUserStore()
  const { fetchUserInfo, updateUserConfig } = userStore

  const dialogRef = inject<ComputedRef<DynamicDialogInstance>>('dialogRef')

  async function updateUserName(item: Items) {
    if (item.oldValue === item.value)
      return

    const { code, msg } = await API.base.userChangeUsernameCreate({
      userName: item.value,
    })
    onlyErrorToast(code, msg)
    if (code === 0) {
      fetchUserInfo()
      item.oldValue = item.value
    }
  }

  async function saveUserConfig(item: Items, _items: SettingsModule | null = null) {
    if (!item.vaildator || item.vaildator(item)) {
      const value = item.formatValue?.(item) ?? item.value
      const { code, msg } = await API.base.userSetUserConfigCreate({
        [item.name as any]: value,
      })
      onlyErrorToast(code, msg)
      if (code === 0) {
        globalThis.electronAPI.send('app:saveSoftConfig', { [item.name as any]: isProxy(value) ? toRaw(value) : value })
        console.log('saveUserConfig', item.name, value)
        updateUserConfig()
      }
    }
  }

  async function saveLocalConfig(item: Items) {
    if (item.vaildator && !item.vaildator(item)) {
      return
    }
    const config = buildLocalConfig(item)
    await globalThis.electronAPI.send('app:saveSoftConfig', config as never)
    if (item.name === 'proxyHostPort') {
      item.oldValue = Array.isArray(item.value) ? [...item.value] : item.value
    }
    else {
      item.oldValue = item.value
    }
  }

  async function saveLocalAppNetworkFields(settingsModule: SettingsModule) {
    const allItems = settingsModule.list.flatMap(section => section.items)
    const names = ['proxyHostPort', 'proxyUsername', 'proxyPassword', 'proxyProtocol']
    for (const name of names) {
      const found = allItems.find(i => i.name === name)
      if (!found) {
        continue
      }
      const config = buildLocalConfig(found)
      await globalThis.electronAPI.send('app:saveSoftConfig', config as never)
      if (found.name === 'proxyHostPort') {
        found.oldValue = Array.isArray(found.value) ? [...found.value] : found.value
      }
      else {
        found.oldValue = found.value
      }
    }
  }

  async function detectLocalNetwork(item: Items) {
    try {
      item.value = await globalThis.electronAPI.send('proxy:detectNetwork', 'local')
    }
    catch (error) {
      item.value = null
      onlyErrorToast(-1, error as string)
    }
  }

  async function detectSystemNetwork(item: Items) {
    try {
      item.value = await globalThis.electronAPI.send('proxy:detectNetwork', 'system')
    }
    catch (error) {
      item.value = null
      onlyErrorToast(-1, error as string)
    }
  }

  async function detectCustomAppNetwork(item: Items, settingsModule?: SettingsModule) {
    if (!settingsModule) {
      return
    }

    try {
      const params = buildCustomProxyCheckParams(settingsModule)
      if (!isValidCustomProxyParams(params)) {
        onlyErrorToast(-1, $t('请先填写完整的代理 IP 信息'))
        item.value = null
        return
      }

      await saveLocalAppNetworkFields(settingsModule)
      const result = await testProxy(params)
      item.value = result
      batchTestShowToast([result], {
        reCheck: () => detectCustomAppNetwork(item, settingsModule),
      })
    }
    catch (error) {
      item.value = null
      onlyErrorToast(-1, error as string)
    }
  }

  return {
    dialogRef,
    showFormDialog,
    showToast,
    userStore,
    simpleLocale,
    updateUserName,
    saveUserConfig,
    saveLocalConfig,
    detectLocalNetwork,
    detectSystemNetwork,
    detectCustomAppNetwork,
    onlyErrorToast,
  }
}
