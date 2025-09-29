<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="tsx">
import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { RxAlert } from '/@/components/rx-alert/'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import AccountCreate from '/@/views/account/create/quick.vue'
import AccountList from '/@/views/account/list/quick.vue'
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue';
import { useSimpleDialog } from '/@/components/simplePopup'
import TransferModal from '/@/views/browser/list/transfer/transfer-modal.vue'
import { ClearType, ProfileModifyType, ProfileOpenStatus, ProxyType } from '/@/enums'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { copyText, filterFieldByValue, getFormData, isEmptyValue, deepClone, safeParseJSON, createDefaultObject } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { getColumns } from './columns'
import BrowserControl from './components/browser-control.vue'
import ClearCache from './components/clear-cache.vue'
import CustomFilters from './components/custom-filters.vue'
import EditCookies from './components/edit-cookies.vue'
import ExportProfiles from './components/export-profiles.vue'
import ProfileInfo from './components/profile-info/index.vue'
import ProjectIcon from './components/project-icon.vue'
import TagsIcon from './components/tags-icon.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { silentUpdateProxy, silentUpdateAccount, clearProxyKeys } from './components/util'
import { getCustomFilters, getOperation, getSorts, getAdvancedSearch } from './operation'
import { useHandleBusinessCode, toUpgradePlan, switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { emitter } from '/@/utils/eventBus'
import { I18nT } from "vue-i18n"
import { useDrawer } from '/@/hooks/useDrawer'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts';
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import ProfileName from './components/profile-name.vue'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

const props = withDefaults(defineProps<{
  currentFilter?: Record<string, any>,
  isProjectProfile?: boolean
}>(), {
  isProjectProfile: false,
})

const emit = defineEmits(['updateFilterTabs', 'switchTab'])

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const drawerInstance = useDrawer()
const role = useRoleStore()
const workspaceStore = useWorkspaceStore()
const { userInfo, userPayInfo, userConfig } = storeToRefs(useUserStore())
const { handleBusinessCode } = useHandleBusinessCode()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { getProjects } = useMateGroup()
const [showModal] = RxUseDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions()
const [show] = useContextMenu()
const { showSimpleDialog } = useSimpleDialog()
const { columns, updateColumns, updateRemarkDisplayStatus } = useColumns(getColumns(), props.isProjectProfile ? ['project'] : undefined)

const userStore = useUserStore()
const tableRef = useTemplateRef('windownTable')
const tagsIconRef = useTemplateRef('tagsIcon')
const filtersMenu = ref()
const openMessage = reactive<any>({})
const hasFiltered = ref(false)
const advancedSearchOptions = getAdvancedSearch()

const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())

watch(() => props.currentFilter, (value: any) => {
  if (value) {
    getCustomFilters(value.filter_condition || {})
      .then((data) => {
        filtersMenu.value = data
        onRefreshTable(value._params)
      })
  }
})

watch(
  () => route.params.id,
  () => {
    if (route.params.id) {
      tableRef.value?.refresh()
    }
  },
)

let canceOpenlListener: any
let canceCloselListener: any
let canceCloseSyncingDataListener: any

onBeforeMount(() => {
  canceOpenlListener = listenOpenMessage()
  canceCloselListener = listenCloseMessage()
  canceCloseSyncingDataListener = listenCloseSyncingDataMessage()

  // 列表备注显示状态现在保存到后台
  updateColumns((columns) => {
    const column = columns.find(column => column.key === 'note')
    if (column) {
      Reflect.set(column._cache, 'extend', userConfig.value.remarkDisplayStatus!)
    }
  })

  window.electronAPI
    .send('browser:getOpenedBrowserMessage')
    .then((state) => {
      console.log('browser:getOpenedBrowserMessage state', state)
      state.forEach((item: any) => {
        Reflect.set(openMessage, item.dirId, { data: item })
      })
    })

  const customFilterParams = safeParseJSON(route.query.customFilterParams, {})

  getCustomFilters(customFilterParams).then((data) => {
    filtersMenu.value ??= data
  }).finally(() => {
    onRefreshTable(customFilterParams, false)
  })
})

onBeforeUnmount(() => {
  canceOpenlListener?.()
  canceCloselListener?.()
  canceCloseSyncingDataListener?.()
})

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...props.currentFilter?._params,
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  hasFiltered.value = !isEmptyValue(params)
  tableRef.value?.refresh(params, force)
}

async function saveFilters(formData: any) {
  if (!filtersMenu.value.some((item: any) => item.value)) {
    return
  }
  const { filter_name, filter_rule, sort } = formData

  const filter_condition = filtersMenu.value.reduce((acc: any, cur: any) => {
    if (cur.value) {
      acc[cur.name] = toRaw(cur.value)
    }
    return acc
  }, {})

  const isEdit = !!sort

  const { code, msg } = isEdit
    ? await API.window.userUpdateWindowFilterNameCreate({
      sort,
      filter_rule,
      filter_condition,
      old_filter_name: filter_name,
      new_filter_name: filter_name,
    })
    : await API.window.userAddWindowFilterNameCreate({
      filter_name,
      filter_condition,
      filter_rule: columns.value.map((column: any) => ({ name: column.key, sort: column._sort, status: column._visible ? 1 : 0 })),
    })
  if (code === 0) {
    emit('updateFilterTabs', isEdit)
  }
  onlyErrorToast(code, msg)
}

async function tableRequest(params: any) {
  // 0: 未删除
  const data = await API.window.userGetWindowInfoListList({ projectIds: route.params.id, ...params, isDelete: 0 })
  const rows = (data.data?.rows || []).map(item => ({
    ...item,
    projectName: item.projectName === '无项目' ? $t('默认项目') : item.projectName,
  }))
  autoOpenBrowser(rows)
  data.data.rows = rows
  return data
}

async function operationHandler(operate: any, data: any, operationType: 'single' | 'batch' = 'single') {
  /**
   * 兼容批量操作
   */
  const datas: Data[] = [].concat(data).map(item => toRaw(item))
  const ids = datas.map(item => item.id!)

  switch (operate.name) {
    case 'edit':
      const { page_index } = tableRef.value!.getParams()
      const customFilterParams = filtersMenu.value.reduce((acc: any, cur: any) => {
        if (cur.value) {
          acc[cur.name] = toRaw(cur.value)
        }
        return acc
      }, {})
      router.push({
        name: 'browser-edit',
        query: {
          ...route.query,
          id: data.id,
          page_index,
          activeTabId: props.currentFilter?.id,
          customFilterParams: JSON.stringify(customFilterParams)
        }
      })
      break
    case 'copyId':
      copyText(data.dirId)
      showToast(0, $t('复制成功'))
      break
    case 'transfer':
      await onTransfer(datas, operate)
      break
    case 'moveToProject':
      await onMoveToProject(data)
      break
    case 'open':
    case 'view':
      await openBrowserBefore(data)
      break
    case 'addProxy':
      multipleProxyChange(data, { operationType, proxyMethod: 'custom' })
      break
    case 'chooseProxy':
      multipleProxyChange(data, { operationType, proxyMethod: 'choose' })
      break
    case 'deleteProxy':
      await multipleProxyDelete(data)
      break
    case 'addPlatformAccount':
      multipleAccountChange(data, { operationType, isChoose: false })
      break
    case 'choosePlatformAccount':
      multipleAccountChange(data, { operationType, isChoose: true })
      break
    case 'restart':
      const dirIds = datas.filter(item => item.openLimitStatus).toSorted((a, b) => a.windowSortNum! - b.windowSortNum!).map(item => item.dirId!)
      if (dirIds.length) {
        window.electronAPI.send('browser:batchRelaunch', dirIds)
      }
      break
    case 'close':
      window.electronAPI.send('browser:batchClose', datas.map((item: any) => item.dirId)).then((res) => {
        console.log('browser:batchClose res', res)
      })
      break
    case 'addTag':
      if (operationType === 'batch') {
        tagsIconRef.value?.openMenu(operate._event)
      } else {
        addTag({
          confirmNext: ({ params, res }: any) => {
            updateProfileMeta({
              labelInfo: [...data.labelInfo, { labelColor: params.color, labelName: params.name, labelId: res.data.id }],
              labelIds: [...data.labelIds, res.data.id]
            }, data)
          },
        })
      }
      break
    case 'fav':
      singleModifyWindow({ id: data.id, isOften: !data.isOften }, true)
        .then(() => {
          data.isOften = !data.isOften
        })
      break
    case 'addNotes':
      await onRemark(data)
      break
    case 'editCookies':
      onEditCookies(data)
      break
    case 'clearCache':
      onClearCache(datas)
      break
    case 'exportProfile':
      exportProfile(datas)
      break
    case 'delete':
      await deleteProfile(datas, ids)
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

function autoOpenBrowser(list: Data[]) {
  const query = route.query.browser && JSON.parse(route.query.browser as string)
  if (query?.openBrowser) {
    const data = list.find(item => item.id === query.windowId)
    router.replace({ name: route.name })
    if (data) {
      openBrowserBefore(data)
    }
  }
}

async function openBrowserBefore(data: Data | Data[]) {
  //过滤打开限制的 profile
  const datas = ([] as Data[]).concat(data)
    .filter(item => item.openLimitStatus)
    .toSorted((a, b) => a.windowSortNum! - b.windowSortNum!)

  if (!datas.length) {
    return
  }

  datas.forEach((item, index) => {
    Reflect.set(openMessage, item.dirId!, {
      pending: true,
      data: {
        message: `${index === 0 ? $t('启动中...') : $t('等待中...')}`
      }
    })
  })

  const result = await checkProfileStatus(datas)
  //过滤自身打开的窗口
  const openList = result.filter(item => !item.statusInfo.some(info => info.openUserId === userInfo.value.id))
  // 1.如果没有其他人打开窗口，则直接打开
  if (!openList.length) {
    onOpenBrowser(datas)
    return
  }

  // 2.如果窗口其他人打开了，那么就提示用户，让用户选择是否继续打开
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
    accept: async () => {
      onOpenBrowser(datas)
    },
    reject: async () => {
      datas.forEach(item => {
        Reflect.deleteProperty(openMessage, item.dirId!)
      })
    },
  })
}

async function checkProfileStatus(datas: Data[]) {
  const ids = datas.map(item => item.id!)
  const { data } = await API.window.userGetWindowStatusInfoCreate({ ids })
  return data.filter(item => item.openStatus === ProfileOpenStatus.opened)
}

function onOpenBrowser(datas: Data[]) {
  const dirIds = datas.map(item => item.dirId!)
  if (dirIds.length) {
    window.electronAPI.send('browser:batchLaunch', dirIds)
  }
}

function showOperationMenu(props: { event: Event, operation: any[] }, data: any) {
  if (userPayInfo.value.onboardingTaskStatus?.contextMenuGuideStatus) {
    show(props.event, {
      operation: props.operation,
      operationHandler: async (operate: any) => {
        try {
          const _operate = { ...deepClone(toRaw(operate)), _event: props.event }
          await operationHandler(_operate, data)
        }
        catch (error) {
          console.log(error)
        }
      }
    })
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ contextMenuGuideStatus: true }),
    slots: {
      container: ({ hideModal }) => <GuideModal
        title={$t('鼠标右键编辑')}
        desc={({ class: className }) => {
          return <div class={className}>{$t('绝大多数的 RoxyBrowser 列表允许您便捷地通过鼠标右键直接编辑，而无需寻找"更多操作"按钮。')}</div>
        }}
        video="/public/video/right-click.mp4"
        onClose={hideModal}
        onConfirm={hideModal}
      ></GuideModal>
    },
  })
}

async function updateProfileMeta(params: Record<string, any>, data: Data, type?: 'single' | 'batch') {
  const { projectId, labelIds } = params
  // why? 当标签关联人员的时候，需要调单个修改窗口的接口
  const datas = ([] as Data[]).concat(data);
  const ids = datas.map(item => item.id!);

  (type === 'single'
    ? singleModifyWindow({ projectId, labelIds, id: ids[0] }, true)
    : batchModifyWindow({ projectId, labelIds, ids }, true)
  ).then(() => {
    const updateParams = Object.entries(params).filter(([_, value]) => !!value)
    datas.forEach(item => {
      updateParams.forEach(([key, value]) => {
        item[key as keyof Data] = value
      })
    })
  })
}

async function getNotUsedProfiles(datas: Data[]) {
  if (!datas.some((item: any) => Reflect.has(openMessage, item.dirId))) {
    return datas
  }
  const result = await electronAPI.send('browser:isProcessExists', datas.map((item: any) => item.dirId))
  return datas.filter((_, index) => !result[index])
}

async function onTransfer(datas: Data[], operate?: any) {
  const { code } = await API.pay.userCheckTeamUserRightsList()
  if (code !== 0) {
    if (!role.isOwner) {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('窗口投送不可用'),
        detail: <I18nT keypath={$t('窗口投送不可用，请联系空间的拥有者进行升级，或{link}以激活该跨空间功能。', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('前往升级您的权益')}</a> }}
        </I18nT>
      })
      return
    }

    if (operate._event && ['quick', 'batch_quick'].includes(operate._type)) {
      emitter.emit("showPayWall", {
        event: operate._event,
        params: {
          type: "transfer",
        },
      })
    } else {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('窗口投送不可用'),
        detail: <I18nT keypath={$t('窗口投送为 Roxy 会员功能，{link}以解锁', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
        </I18nT>
      })
    }
    return
  }

  const result = await getNotUsedProfiles(datas)
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('当前已打开的窗口无法被投送'))
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(TransferModal, {
        ids: datas.map(item => item.id!),
        buyProxyType: datas.some(item => item.buyProxyType! === ProxyType.buy),
        onClose: () => {
          hideModal()
          reject()
        },
        onConfirm: async ({ isSelf, needRefresh }: Record<string, boolean>) => {
          hideModal()
          if (!isSelf) {
            showToast(0, $t('未接受或被拒绝的窗口将在24小时内自动返回。'))
            // 如果在项目列表中投送，投送成功则跳到投送中 tab
            if (route.name === 'project-item') {
              router.replace({ name: 'browser-list', query: { activeTabId: 'rx_1004' } })
            } else {
              emit('switchTab', 'rx_1004')
            }
          } else {
            if (needRefresh) {
              onRefreshTable()
            }
            showToast(0, $t('投送成功'))
          }
          resolve()
        },
      })
    }
  })
  return promise
}

async function onMoveToProject(data: any) {
  const options = await getProjects()
  const datas: any[] = [].concat(data)

  return new Promise((resolve, reject) => {
    const names = datas.slice(0, 10).map((item: any) => `${workspaceName.value}-${item.windowSortNum}`).join(', ')
    const namesStr = `[${names}${datas.length > 10 ? '...' : ''}]`

    showSimpleDialog({
      title: $t('移动项目'),
      content: $t('将移动 {names} 到所选项目', { names: namesStr }),
      inputs: [
        {
          type: 'select',
          name: 'projectId',
          props: {
            placeholder: $t('请选择项目'),
            options,
            optionValue: 'value',
          },
          resolver: (z: any) => z.string({
            invalid_type_error: $t('请选择项目'),
          }).min(1, $t('请选择项目'))
        },
      ],
      onConfirm: async (formData: any) => {
        if (formData.projectId) {
          const ids = datas.filter((item: any) => item.projectId !== Number(formData.projectId)).map((item: any) => item.id)
          if (!ids.length) {
            onlyErrorToast(-1, $t('所选窗口 {names} 已在该项目中', { names: namesStr }))
            return
          }
          await batchModifyWindow({ ids, projectId: formData.projectId }, true)
            .then(() => {
              const projectName = options.find(item => item.value === formData.projectId)!.label
              datas.forEach(item => {
                item.projectName = projectName
                item.projectId = Number(formData.projectId)
                item.labelInfo = item.labelInfo!.filter((it: any) => !it.labelId.startsWith?.('u_'))
                item.labelIds = item.labelInfo!.map((it: any) => it.labelId)
              })
            })
        }
        resolve(true)
      },
      onCancel: () => {
        reject($t('取消'))
      },
    })
  })
}

function multipleProxyChange(data: Data | Data[], { operationType, proxyMethod }: any) {
  const datas = ([] as Data[]).concat(data)
  const isMulti = operationType === 'batch'
  const isChoose = proxyMethod === 'choose'

  const _proxydata = {
    id: datas[0].moduleId,
    ...Object.fromEntries(
      ['host', 'ipType', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'checkChannel']
        .map(key => [key, datas[0][key as keyof Data]])
    )
  }

  const containerRender = isChoose
    ? () => <div class="h-full flex flex-col">
      {isMulti && <div class="px-4 pt-4">
        <RxAlert class="min-w-full" type="warn" closable={false} title={$t('此操作将覆盖所有选中窗口的代理设置，请谨慎操作。')}></RxAlert>
      </div>}
      <ProxyQuick class="flex-1 overflow-hidden" {...{
        data: isMulti ? undefined : _proxydata,
        onConfirm,
      }}></ProxyQuick>
    </div>
    : () => <ProxyCreate onConfirm={onConfirm}></ProxyCreate>

  drawerInstance.showDrawer({
    title: isChoose ? $t('选择代理') : $t('添加代理'),
    dismissable: false,
    slots: {
      container: containerRender
    }
  })

  async function onConfirm({ id, ...formData }: any) {
    const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
      type: isChoose ? ProfileModifyType.ProxySelect : ProfileModifyType.ProxyAdd,
      ids: datas.map(item => item.id!),
      paramList: {
        moduleId: id ?? 0,
        proxyMethod,
        ...formData
      }
    })
    drawerInstance.hideDrawer()
    onlyErrorToast(code, msg)
    if (code !== 0) return

    const { protocol, proxyCategory, proxyType, ...rest } = formData
    const params = {
      ...rest,
      moduleId: id ?? 0,
      proxyMethod,
      protocol,
      proxyCategory: proxyCategory || protocol,
      buyProxyType: proxyType ?? ProxyType.resource,
    }
    datas.forEach(item => {
      silentUpdateProxy(item, params, ['isEncryptProxy', 'proxyEncryptInfo'])
    })
  }
}

function multipleProxyDelete(data: Data | Data[]) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const datas = ([] as Data[]).concat(data)

  confirm.require({
    header: $t('删除代理'),
    message: $t('您确认要删除代理吗？'),
    rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
    acceptProps: { label: $t('确认'), severity: 'danger' },
    accept: async () => {
      const ids = datas.map(item => item.id!)
      const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ ids, type: ProfileModifyType.ProxyDelete })
      onlyErrorToast(code, msg)
      resolve()
      if (code === 0) {
        const params = {
          moduleId: 0, // 为 0 表示解除关联
          proxyCategory: 'noproxy',
          proxyMethod: 'custom',
          ...createDefaultObject(clearProxyKeys, ''),
        }
        datas.forEach(item => {
          if (!item.openTime) {
            Reflect.set(params, 'lastIp', '')
          } else {
            Reflect.deleteProperty(params, 'lastIp')
          }
          silentUpdateProxy(item, params, ['isEncryptProxy', 'proxyEncryptInfo'])
        })
      }
    },
    reject: () => {
      reject()
    }
  })
  return promise
}

function multipleAccountChange(data: Data | Data[], { operationType, isChoose = false }: any) {
  const datas = ([] as Data[]).concat(data)
  const isMulti = operationType === 'batch'

  const title = isChoose
    ? $t('选择平台账号')
    : $t('添加平台账号')

  const containerRender = isChoose
    ? () => <div class="h-full flex flex-col">
      {isMulti && <div class="px-4 pt-4">
        <RxAlert class="min-w-full" type="warn" closable={false} title={$t('此操作将清空所选窗口中的平台账号，并将新选择的平台账号绑定至窗口，请谨慎操作。')}></RxAlert>
      </div>}
      <AccountList class="flex-1 overflow-hidden" data={isMulti ? undefined : datas[0]} onConfirm={onConfirm}></AccountList>
    </div>
    : () => <AccountCreate showRemark={false} showCreateMore={false} onConfirm={onConfirm}></AccountCreate>

  drawerInstance.showDrawer({
    title,
    dismissable: false,
    slots: {
      container: containerRender
    }
  })

  async function onConfirm(formData: any) {
    const { code, msg } = isMulti
      ? await multiConfirm(formData)
      : await singleConfirm(formData)
    drawerInstance.hideDrawer()
    onlyErrorToast(code, msg)
  }

  async function multiConfirm(dataList: any | any[]) {
    const platformUrlIds = ([] as any[]).concat(dataList).map(item => item.id)
    const paramList = isChoose ? { platformUrlIds } : { windowPlatformList: [dataList] }
    const type = isChoose ? ProfileModifyType.PlatformSelect : ProfileModifyType.PlatformAdd
    const ids = datas.map(item => item.id!)

    const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ paramList, type, ids })

    if (code === 0) {
      datas.forEach((item, index) => {
        const _windowPlatformList = isChoose && Array.isArray(dataList)
          ? dataList
          : item.windowPlatformList!.concat({ ...dataList, _tempId: (Date.now() + index ** 2).toString(32) })
        silentUpdateAccount(item, _windowPlatformList)
      })
    }
    return { code, msg }
  }

  async function singleConfirm(formData: any) {
    const { id, dirId, windowPlatformList } = datas[0]
    const params: any = { id, dirId }
    if (isChoose) {
      params.platformUrlIds = (formData as any[]).filter(item => item.id).map(item => item.id)
    } else {
      params.windowPlatformList = windowPlatformList!.concat({ ...formData, _tempId: Date.now().toString(32) })
    }
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    if (code === 0) {
      const _windowPlatformList = params.windowPlatformList || windowPlatformList!.filter((item: any) => !item.id).concat(formData)
      silentUpdateAccount(datas[0], _windowPlatformList)
    }
    return { code, msg }
  }
}

async function onEditCookies(data: Data | Data[]) {
  const datas = ([] as Data[]).concat(data)
  const names = datas.slice(0, length).map(item => `${workspaceName.value}-${item.windowSortNum}`).join(', ')
  const namesStr = `[${names}${datas.length > length ? '...' : ''}]`
  const isMulti = datas.length > 1
  drawerInstance.showDrawer({
    title: $t('为 {names} 编辑 Cookies', { names: namesStr }),
    dismissable: false,
    slots: {
      container: () => <div class="h-full flex flex-col">
        {isMulti && <div class="px-4 pt-4">
          <RxAlert class="min-w-full" type="warn" closable={false} title={$t('所选窗口的所有 Cookie 都将被覆盖，请谨慎操作。')}></RxAlert>
        </div>}
        <EditCookies class="flex-1"
          data={datas.length > 1 ? undefined : datas[0]}
          onConfirm={onConfirm}
        ></EditCookies>
      </div>
    }
  })

  async function onConfirm(formData: any) {
    const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
      type: ProfileModifyType.CookieEdit,
      ids: datas.map(item => item.id!),
      paramList: {
        cookie: formData
      }
    })
    drawerInstance.hideDrawer()
    onlyErrorToast(code, msg)
    if (code !== 0) return
    datas.forEach(item => {
      Reflect.set(item, 'cookie', formData)
    })
  }
}

async function onRemark(data: Data | Data[]) {
  const datas = ([] as Data[]).concat(data)
  return new Promise((resolve, reject) => {
    showSimpleDialog({
      title: $t('为所选窗口添加备注'),
      inputs: [
        {
          type: 'textarea',
          name: 'windowRemark',
          value: datas[0].windowRemark,
          props: {
            placeholder: $t('请输入备注'),
            rows: 6,
          }
        },
      ],
      onConfirm: async (formData: any) => {
        try {
          const ids = datas.map(item => item.id)
          await batchModifyWindow({ ids, windowRemark: formData.windowRemark }, true)
          datas.forEach(item => {
            item.windowRemark = formData.windowRemark
          })
        } finally {
          resolve(true)
        }
      },
      onCancel: () => {
        reject($t('取消'))
      },
    })
  })
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

async function onClearCache(datas: any[]) {
  dialog.open(ClearCache, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: $t('清空窗口缓存'),
        content: $t('清除时系统会自动关闭窗口，且可能导致登录状态失效'),
      },
      onConfirm: async (result: ClearType) => {
        const dirIds = datas.map(item => item.dirId)
        if (result === ClearType.cloud) {
          await electronAPI.send('browser:clearCache', { clearType: ClearType.all, dirIds }).finally(() => {
            return API.window.userClearWindowCacheCreate({ ids: datas.map(item => item.id) })
          })
        }
        else {
          await electronAPI.send('browser:clearCache', { clearType: result, dirIds })
        }
      },
    },
  })
}

async function exportProfile(data: any) {
  dialog.open(ExportProfiles, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        data,
        workspaceName: workspaceName.value,
      }
    },
  })
}

async function deleteProfile(datas: any, ids: number[]) {
  const result = await getNotUsedProfiles(datas)
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('请先关闭窗口'))
    return
  }

  // 每次删除窗口前，先同步一下窗口的打开状态，避免无法删除
  const windowStatus = ids.map(id => ({ id, openStatus: false }))
  await API.window.userMdfWindowSyncV2Create(windowStatus)

  const usePeoples = datas.some((item: any) => item.statusInfo.filter((item: any) => item.openUserId !== userStore.userInfo.id).length > 0)

  if (usePeoples) {
    onlyErrorToast(-1, $t('无法删除正在被其他成员使用的窗口'))
    return
  }

  return new Promise((resolve, reject) => {
    confirm.require({
      group: 'deleteConfirmDialog',
      header: $t('删除窗口'),
      message: $t('您确认要将所选窗口移至回收站吗？'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('确认'),
        severity: 'danger',
      },
      checkboxProps: {
        label: $t('彻底删除'),
        value: false,
      },
      async accept() {
        if (this.checkboxProps.value) {
          await API.window.userDelWindowInfoCreate({ ids })
          onRefreshTable()
          electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
        } else {
          await batchModifyWindow({ ids, isDelete: true })
        }

        resolve(true)
      },
      reject: () => {
        reject($t('取消'))
      },
    } as any)
  })
}

async function singleModifyWindow(params: any, silent = false) {
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    if (!silent) {
      onRefreshTable()
    }
    return Promise.resolve()
  } else {
    return Promise.reject(msg)
  }
}

async function batchModifyWindow(params: any, silent = false) {
  const { code, msg } = await API.window.userMdfWindowInfoBatchV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    if (!silent) {
      onRefreshTable()
    }
    return Promise.resolve()
  } else {
    return Promise.reject(msg)
  }
}

function showDiskSpaceModal() {
  showModal({
    header: $t('磁盘空间不足'),
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(DiskInsufficient, {
        onClose: hideModal
      })
    }
  })
}

function listenOpenMessage() {
  return window.electronAPI.on('browser:launch-process-message', (event) => {
    if (event.code === 1 && event.message.includes('ERR101')) {
      showDiskSpaceModal()
    }
    const id = event.data?.dirId || event.data
    Reflect.set(openMessage, id as string, event)
  })
}

function listenCloseMessage() {
  return window.electronAPI.on('browser:on-close', (dirIds) => {
    dirIds.forEach((dirId) => {
      Reflect.deleteProperty(openMessage, dirId)
    })
  })
}

function listenCloseSyncingDataMessage() {
  return window.electronAPI.on('browser:on-close-syncing-data', (dirIds) => {
    dirIds.forEach((dirId) => {
      const message = Reflect.get(openMessage, dirId)
      if (message?.data) {
        message.uploading = true
        message.data.message = $t('同步数据中...')
      }
    })
  })
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code === 0) {
    router.push({ name: 'browser-create', query: { projectId: route.params.id } })
  } else {
    handleBusinessCode(code, () => {
      showToast(code, msg)
    })
  }
}

defineExpose({
  tableRef,
})
</script>

<template>
  <RyTable ref="windownTable" v-model:columns="columns" cacheKey="browser-list" :immediate="false" skeleton :table-sort="getSorts" :table-request="tableRequest" :table-operation="getOperation"
    :operation-handler="operationHandler" selection-mode="multiple" :show-actions="false" :virtualScrollerOptions="{ itemSize: 60 }" class="window-table" removableSort>
    <template #filter-after>
      <div class="w-full flex items-start gap-2">
        <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch"></AdvancedSearch>
        <RxDivider class="py-1" vertical line-only></RxDivider>
        <CustomFilters :current-filter="currentFilter" :filters-menu="filtersMenu" :enabled-filter-save="!isProjectProfile" video-url="/public/video/profile-filter.mp4" :save-filters="saveFilters"
          @filter-change="onRefreshTable" />
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomNewEmpty v-else icon="base/rx_ic_browser" img="empty-profiles.png" :title="$t('暂无窗口')" :desc="$t('窗口是 RoxyBrowser 的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理等，以方便您更好地执行业务操作。')">
        <template #extra>
          <div class="flex gap-3">
            <RxButton v-if="!role.isViewer" severity="secondary" size="md" icon="base/rx_ic_browser_add" variant="outlined" :label="$t('创建窗口')" @click.stop="toCreateBrowser" />
            <TutorialVideo video-type="create_profile" :autoplay="false" />
          </div>
        </template>
      </CustomNewEmpty>
    </template>
    <template #profile="{ data }">
      <template v-if="data.id">
        <ProfileInfo ref="pfi" :workspace-name="workspaceName!" :data="data" :open-message="openMessage" @refresh="onRefreshTable" />
      </template>
      <div v-else class="flex items-center gap-[16px]">
        <Skeleton width="44px" height="16px"></Skeleton>
        <div class="flex items-center gap-[1px]">
          <template v-for="i in 3" :key="i">
            <div v-if="i > 1" class="dotted-line"></div>
            <Skeleton width="24px" height="24px" borderRadius="4px"></Skeleton>
          </template>
        </div>
      </div>
    </template>
    <template #profileName="{ data }">
      <template v-if="data.id">
        <ProfileName :data="data" @refresh="onRefreshTable" />
      </template>
      <template v-else>
        <Skeleton width="160px" height="24px" borderRadius="4px"></Skeleton>
      </template>
    </template>
    <template #open="{ data }">
      <template v-if="data.id">
        <BrowserControl :data="data" :open-message="openMessage" @open="openBrowserBefore" />
      </template>
      <template v-else>
        <Skeleton width="70px" height="24px" borderRadius="4px"></Skeleton>
      </template>
    </template>
    <template #noteHeader="{ column: { title, _cache } }">
      <div class="flex items-center gap-2 note-header">
        <span>{{ title }}</span>
        <RxSvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
          @click.stop="toggleRemarkDisplayStatus(_cache)" />
      </div>
    </template>
    <template #note="{ data, column: { _cache } }">
      <template v-if="data.id">
        <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'addNotes' }, data)">
          <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.windowRemark }" text severity="secondary" size="xxs"
            :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" />
          <div v-if="_cache.extend" :title="data.windowRemark" class="min-w-50 whitespace-pre-wrap note-content">{{
            data.windowRemark }}</div>
        </div>
      </template>
      <template v-else>
        <Skeleton width="24px" height="24px" borderRadius="4px"></Skeleton>
      </template>
    </template>
    <template #project="{ data }">
      <template v-if="data.id">
        <ProjectIcon :labels="data.labelInfo" :project-id="data.projectId" :project-name="data.projectName" @update="updateProfileMeta($event, data)" />
      </template>
      <template v-else>
        <Skeleton width="100px" height="20px" borderRadius="4px"></Skeleton>
      </template>
    </template>
    <template #tags="{ data }">
      <template v-if="data.id">
        <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" @update="updateProfileMeta($event, data, 'single')" />
      </template>
      <template v-else>
        <Skeleton width="70px" height="24px" borderRadius="12px"></Skeleton>
      </template>
    </template>
    <template #actions="{ data }">
      <div class="flex items-center gap-2">
        <template v-if="!data.id">
          <template v-for="i in 3" :key="i">
            <Skeleton width="24px" height="24px" borderRadius="4px"></Skeleton>
          </template>
        </template>
        <template v-else>
          <div v-tooltip.top="{ value: $t('收藏'), showDelay: 500 }"
            class="flex justify-center items-center rounded cursor-pointer w-7 h-7 transition-all duration-150 hover:bg-black hover:bg-opacity-5 quick-icon"
            @click.stop="operationHandler({ name: 'fav' }, data)">
            <RxSvgIcon :name="data.isOften ? 'base/rx_ic_bookmark_fill' : 'base/rx_ic_bookmark'" :class="{ 'color-[#FC9D12]': data.isOften }" />
          </div>
          <Actions :operation="getOperation(data)" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
        </template>
      </div>
    </template>
  </RyTable>
  <TagsIcon ref="tagsIcon" :labels="[]" :showCreateTag="false" @update="updateProfileMeta($event, tableRef?.selectionData)" />
</template>

<style lang="scss" scoped>
.note-header {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.note-content {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  line-height: 1.4;
}

.note-light {
  :deep(svg) {
    color: var(--colors-text-text-brand, #11A3FD) !important;
  }
}

.quick-icon {
  color: var(--colors-icon-icon-secondary, #575D60);

  &:active:not(.disabled) {
    color: orange;
  }

  &.disabled {
    cursor: not-allowed;
  }
}

:deep(.window-table) {
  tr:not([data-p-selected=true]):hover .direct-info {
    background-color: var(--component-table-bg-hover);
  }

  tr:not([data-p-selected=true]):hover .edit-window-name-icon {
    visibility: visible;
  }
}

.dotted-line {
  width: 30px;
  height: 1px;
  border-top: 1px dashed var(--colors-border-border-inactive, #C7D1D6);
}
</style>
