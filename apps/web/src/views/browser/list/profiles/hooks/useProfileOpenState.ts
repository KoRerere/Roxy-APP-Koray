import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { ProfileOpenStatus } from '/@/enums'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

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
  const { userInfo } = storeToRefs(useUserStore())
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
  const { mixpanelTrack } = useUserStore()

  const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())

  const openMessage = reactive<Record<string, any>>({})

  function sendFirstOpenRecord() {
    if (userInfo.value.onboardingTaskStatus?.firstOpenWindowStatus === false) {
      updateOnboardingTaskStatus({ firstOpenWindowStatus: true })
      mixpanelTrack('open_profile_first')
    }
  }

  function listenOpenMessage() {
    return globalThis.electronAPI.on('browser:launch-process-message', (event) => {
      if (event.code === 1 && event.message.includes('ERR101'))
        showDiskSpaceModal()

      const id = event.data?.dirId || event.data
      Reflect.set(openMessage, id as string, event)
      if (event.code === 0 && event.data?.percent === 100)
        sendFirstOpenRecord()
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
      Reflect.deleteProperty(openMessage, item.dirId!)
    })
  }

  async function checkProfileStatus(datas: Data[]) {
    const ids = datas.map(item => item.id!)
    const { data } = await API.window.userGetWindowStatusInfoCreate({ ids })
    return data.filter(item => item.openStatus === ProfileOpenStatus.opened)
  }

  function onOpenBrowser(datas: Data[]) {
    const dirIds = datas.map(item => item.dirId!)
    if (dirIds.length)
      globalThis.electronAPI.send('browser:batchLaunch', dirIds)
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
      Reflect.set(openMessage, item.dirId!, {
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
    openBrowserBefore,
    clearMessage,
    checkProfileStatus,
    onOpenBrowser,
    getNotUsedProfiles,
    syncOpenedBrowserState,
  }
}
