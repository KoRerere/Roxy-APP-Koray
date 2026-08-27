import { createProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useRouteContext } from '/@/composables/useRouteContext'
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue'
import OpenedLayoutModel from '/@/views/browser/list/profiles/components/opened-layout-model.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { ProfileOpenStatus } from '/@/enums'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { compare } from 'compare-versions'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { windowManager } from '/@/utils/windowManager'
import type { BrowserProcessMessage, MainMessageResult } from '@roxy/electron-preload'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

/** 窗口列表行数据 */
export type ProfileRow = Omit<UserGetWindowInfoListListData['data']['rows'][number], 'statusInfo'> & {
  proxyExpireStatus?: number
  /** 是否电商专用窗口/账号：true/1 为电商，false/0 为普通 */
  isEcommerce?: boolean | number
  statusInfo?: {
    openUserId?: number
    openUserName?: string
  }[]
}

/** 打开进度消息（Electron IPC + Web 云浏览器共用结构） */
export type ProfileOpenMessage = Partial<MainMessageResult<Partial<BrowserProcessMessage>>> & {
  pending?: boolean
  uploading?: boolean
}

type Data = ProfileRow

/** 创建打开成功消息，与 Electron launch-process-message 结构保持一致 */
export function createOpenSuccessMessage(dirId: string): ProfileOpenMessage {
  return {
    code: 0,
    pending: false,
    uploading: false,
    data: {
      dirId,
      percent: 100,
      message: $t('打开成功'),
      warningMessages: [],
    },
  }
}

/** 创建启动中消息 */
export function createOpeningMessage(dirId: string, message = $t('启动中...')): ProfileOpenMessage {
  return {
    code: 0,
    pending: false,
    uploading: true,
    data: {
      dirId,
      percent: 100,
      message,
      warningMessages: [],
    },
  }
}

/** 写入指定 dirId 的打开状态 */
export function setProfileOpenMessage(
  openMessage: Record<string, ProfileOpenMessage>,
  dirId: string,
  message: ProfileOpenMessage,
) {
  Reflect.set(openMessage, dirId, message)
}

/** 清除指定 dirId 的打开状态 */
export function clearProfileOpenMessage(
  openMessage: Record<string, ProfileOpenMessage>,
  dirId: string,
) {
  Reflect.deleteProperty(openMessage, dirId)
}

/** 判断 Web 端消息是否处于活跃打开流程中，避免 winMap 同步误删 */
function isProfileOpenMessageInProgress(message?: ProfileOpenMessage) {
  if (!message)
    return false
  if (message.pending || message.uploading)
    return true
  if (message.code === 0 && message.data?.percent != null && message.data.percent < 100)
    return true
  return false
}

export function useProfileOpenState() {
  const [showModal] = RxUseDialog()
  const confirm = useConfirm()

  function showDiskSpaceModal() {
    showModal({
      header: $t('磁盘空间不足'),
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0',
      },
      slots: {
        container: ({ hideModal }) => h(DiskInsufficient, {
          onClose: hideModal,
        }),
      },
    })
  }
  const workspaceStore = useWorkspaceStore()
  const userStore = useUserStore()
  const { userInfo, userConfig } = storeToRefs(useUserStore())
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
  const { mixpanelTrack } = useUserStore()
  const [_, onlyErrorToast] = useResponseToast()
  const { isEcommerce } = useRouteContext()
  const profileLabels = computed(() => createProfileEntityLabels(isEcommerce.value))
  const workspaceName = computed(() => getWorkspaceNamePrefix(workspaceStore.currentWorkspace?.workspaceName))

  const openMessage = reactive<Record<string, ProfileOpenMessage>>({})

  /** 根据 winMap 同步 Web 云浏览器打开态，列表级单 watcher 避免每行重复监听 */
  function syncWebWindowOpenState() {
    const winMap = windowManager.winMap.value

    winMap.forEach((win, dirId) => {
      if (win && !win.closed)
        setProfileOpenMessage(openMessage, String(dirId), createOpenSuccessMessage(String(dirId)))
    })

    for (const dirId of Object.keys(openMessage)) {
      const win = winMap.get(dirId)
      if (win && !win.closed)
        continue
      if (isProfileOpenMessageInProgress(openMessage[dirId]))
        continue
      clearProfileOpenMessage(openMessage, dirId)
    }
  }

  /** 注册 Web 端窗口管理器监听，在页面 onBeforeMount 调用 */
  function listenWebWindowManager() {
    if (globalThis.isElectron)
      return () => {}

    return watch(windowManager.winMap, syncWebWindowOpenState, { immediate: true })
  }

  function sendFirstOpenRecord() {
    if (userInfo.value.onboardingTaskStatus?.firstOpenWindowStatus === false) {
      updateOnboardingTaskStatus({ firstOpenWindowStatus: true })
      mixpanelTrack('open_profile_first', {
        profile_open_host: globalThis.isElectron ? 'user_client' : 'cloud_host',
      })
    }
  }

  function listenOpenMessage(options?: {
    onOpenSuccess?: (dirId: string | number) => void
    onOpenFailed?: (dirId: string | number) => void
    /** 打开过程中出现代理检测失败警告时回调，供失败引导 toast 使用 */
    onProxyDetectWarning?: (dirId: string | number, warningMessages: string[]) => void
  }) {
    return globalThis.electronAPI.on('browser:launch-process-message', (event) => {
      if (event.code === 1 && event.message.includes('ERR101'))
        showDiskSpaceModal()

      const dirId = typeof event.data === 'object' && event.data?.dirId != null
        ? event.data.dirId
        : typeof event.data === 'string' || typeof event.data === 'number'
          ? event.data
          : null
      if (dirId == null)
        return

      Reflect.set(openMessage, String(dirId), event as ProfileOpenMessage)
      if (event.code !== 0) {
        options?.onOpenFailed?.(dirId)
        return
      }
      if (typeof event.data === 'object' && event.data.percent === 100) {
        sendFirstOpenRecord()
        options?.onOpenSuccess?.(dirId)
        const warningMessages = event.data.warningMessages?.filter(Boolean) ?? []
        if (warningMessages.length)
          options?.onProxyDetectWarning?.(dirId, warningMessages)
      }
    })
  }

  function listenCloseMessage() {
    return globalThis.electronAPI.on('browser:on-close', (dirIds) => {
      dirIds.forEach((dirId) => {
        Reflect.deleteProperty(openMessage, dirId)
      })
    })
  }

  function listenCloseSyncingDataMessage() {
    return globalThis.electronAPI.on('browser:on-close-syncing-data', (dirIds) => {
      dirIds.forEach((dirId) => {
        const message = Reflect.get(openMessage, dirId)
        if (message?.data) {
          message.uploading = true
          message.data.message = $t('同步数据中...')
        }
      })
    })
  }

  function clearMessage(datas: Data[]) {
    datas.forEach((item) => {
      clearProfileOpenMessage(openMessage, item.dirId!)
    })
  }

  async function checkProfileStatus(datas: Data[]) {
    const ids = datas.map(item => item.id!)
    const { code, data, msg } = await API.window.userGetWindowStatusInfoCreate({ ids }).catch((error) => {
      console.error(error)
      return { code: -1, data: [], msg: profileLabels.value.getStatusFailed }
    })
    if (code !== 0) {
      onlyErrorToast(code, msg)
      return []
    }
    return data.filter(item => item.openStatus === ProfileOpenStatus.opened)
  }

  async function onOpenBrowser(datas: Data[]) {
    const dirIds = datas.map(item => item.dirId!)
    if (dirIds.length) {
      if (dirIds.length === 1 || compare(userStore.appVersion, '3.8.7', '<')) {
        globalThis.electronAPI.send('browser:batchLaunch', dirIds)
        return
      }

      if (userInfo.value.onboardingTaskStatus?.batchOpenWindowNoPromptStatus !== false) {
        if (userConfig.value.batchOpenLayout === 'grid') {
          globalThis.electronAPI.send('browser:chunkBrowsersByScreen', dirIds)
        }
        else {
          globalThis.electronAPI.send('browser:batchLaunch', dirIds)
        }
        return
      }

      showModal({
        showHeader: false,
        modal: true,
        blockScroll: true,
        closeOnEscape: false,
        slots: {
          container: ({ hideModal }) => h(OpenedLayoutModel, {
            count: dirIds.length,
            onClose: () => {
              clearMessage(datas)
              hideModal()
            },
            onConfirm: (value) => {
              if (value === 'grid') {
                globalThis.electronAPI.send('browser:chunkBrowsersByScreen', dirIds)
              }
              else {
                globalThis.electronAPI.send('browser:batchLaunch', dirIds)
              }
              hideModal()
            },
          }),
        },
      })
    }
  }

  async function openBrowserBefore(data: Data | Data[]) {
    if (!globalThis.isElectron) {
      globalThis.electronAPI.send('browser:batchRelaunch', [])
      return
    }
    const datas = ([] as Data[]).concat(data).filter(item => item.openLimitStatus).toSorted((a, b) => a.windowSortNum! - b.windowSortNum!)

    if (!datas.length)
      return

    datas.forEach((item, index) => {
      setProfileOpenMessage(openMessage, item.dirId!, {
        pending: true,
        data: {
          message: `${index === 0 ? $t('启动中...') : $t('等待中...')}`,
        },
      })
    })

    const result = await checkProfileStatus(datas)
    const openList = result.filter(item => !item.statusInfo.some(info => info.openUserId === userInfo.value.id))
    if (!openList.length) {
      onOpenBrowser(datas)
      return
    }

    confirm.require({
      header: $t('警告'),
      message: $t('[{names}] 已被其他成员打开，是否继续打开？', { names: openList.map(item => `${workspaceName.value}-${item.sortNum}`).join(', ') }),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('确认'),
        severity: 'info',
      },
      accept: () => {
        onOpenBrowser(datas)
      },
      reject: () => clearMessage(datas),
      onHide: () => clearMessage(datas),
    })
  }

  async function getNotUsedProfiles(datas: Data[]) {
    if (!datas.some((item: any) => Reflect.has(openMessage, item.dirId)))
      return datas
    const result = await globalThis.electronAPI.send('browser:isProcessExists', datas.map((item: any) => item.dirId))
    return datas.filter((_, index) => !result[index])
  }

  function syncOpenedBrowserState() {
    return globalThis.electronAPI
      .send('browser:getOpenedBrowserMessage')
      .then((state) => {
        state.forEach((item: any) => {
          Reflect.set(openMessage, item.dirId, { data: item })
        })
      })
  }

  return {
    openMessage,
    workspaceName,
    listenOpenMessage,
    listenCloseMessage,
    listenCloseSyncingDataMessage,
    listenWebWindowManager,
    openBrowserBefore,
    clearMessage,
    checkProfileStatus,
    onOpenBrowser,
    getNotUsedProfiles,
    syncOpenedBrowserState,
    sendFirstOpenRecord,
  }
}
