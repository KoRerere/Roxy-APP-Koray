<script setup lang="ts">
import AccountEdit from '/@/views/account/create/quick.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import AccountFieldCell from '/@/views/account/list/components/account-field-cell.vue'
import PlatformInfoCell from '/@/views/account/list/components/platform-info-cell.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import ProfileSelect from '/@/views/account/list/components/profile-select.vue'
import ExportAccounts from '/@/views/account/list/components/export-accounts.vue'
import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getRelatedProfileLabels, useColumns } from './columns'
import { useDrawer } from '/@/hooks/useDrawer'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { PlatformPermissionCode } from '/@/stores/permission'
import { copyText } from '/@/utils'
import { formatAccountCopyText, parseWindowInfo } from './utils'
import { PlatformReqType } from '/@/enums'
import { useDialog } from 'primevue/usedialog'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useRoleStore } from '/@/stores/role'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const drawerInstance = useDrawer()
const { userConfig } = storeToRefs(useUserStore())
const [showToast, onlyErrorToast] = useResponseToast()
const { columns, updateRemarkDisplayStatus } = useColumns()
const { showSimpleDialog } = useSimpleDialog()
const { check } = usePermission()
const workspaceStore = useWorkspaceStore()
const { isViewer } = storeToRefs(useRoleStore())
const canEdit = computed(() => !isViewer.value)
const workspaceName = computed(() => getWorkspaceNamePrefix(workspaceStore.currentWorkspace?.workspaceName))
const canViewPassword = computed(() => check(PlatformPermissionCode.ViewPassword))
const canBatchExport = computed(() => check(PlatformPermissionCode.BatchExport))

watch(isViewer, (viewer) => {
  const actionsColumn = columns.value.find(column => column.key === 'actions')
  if (actionsColumn)
    actionsColumn._visible = !viewer
}, { immediate: true })

const tableRef = useTemplateRef('account')
const tableSelection = ref<Data[]>([])
const exportData = ref<Data[]>([])

const operation = ref([
  {
    name: 'copy',
    label: $t('复制'),
    icon: 'base/rx_ic_copy',
    tooltip: $t('复制'),
    quick: true,
  },
  {
    name: 'edit',
    label: $t('编辑'),
    icon: 'base/rx_ic_edit',
    power: check(PlatformPermissionCode.Edit),
    tooltip: $t('编辑'),
    quick: true,
  },
  {
    name: 'remark',
    label: $t('添加备注'),
    icon: 'base/rx_ic_doc_add',
    multiple: true,
    multipleProps: {
      name: 'G1',
      showLabel: true,
    },
  },
  {
    separator: true,
  },
  {
    name: 'delete',
    label: $t('删除'),
    icon: 'base/rx_ic_bin_1',
    power: check(PlatformPermissionCode.Delete),
    quick: true,
    tooltip: $t('删除'),
    multiple: true,
    multipleProps: {
      name: 'G2',
      showLabel: true,
    },
  },
])

const advancedSearchOptions = [
  {
    key: 'platform',
    label: $t('平台名称'),
    icon: 'base/rx_ic_keys',
    syntax: 'platform::',
  },
  {
    key: 'account',
    label: $t('账号名称'),
    icon: 'base/rx_ic_user_key',
    syntax: 'account::',
  },
  {
    key: 'remark',
    label: $t('备注'),
    icon: 'base/rx_ic_doc_article',
    syntax: 'note::',
  },
]

async function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'copy':
      onCopyAccount(data)
      break
    case 'edit':
      editAccount(data)
      break
    case 'remark':
      await onRemark(data)
      break
    case 'delete':
      await deletePopup(data)
      break
    case 'create':
      createAccount()
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  tableRef.value?.refresh({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

async function tableRequest(params: any) {
  const result = await API.platform.userGetPlatformInfoV2List(params)
  if (result.code === 0)
    exportData.value = result.data.rows as Data[]
  return result
}

function createAccount() {
  router.push({ name: 'account-create' })
}

function editAccount(data?: Data) {
  drawerInstance.showDrawer({
    title: $t('编辑平台账号'),
    slots: {
      container: () => h(AccountEdit, {
        data,
        onClose: () => {
          drawerInstance.hideDrawer()
        },
        onConfirm: async (formData: any) => {
          const { code, msg } = await API.platform.userMdfPlatformInfoCreate({ platformList: [formData] })
          onlyErrorToast(code, msg)
          if (code === 0) {
            tableRef.value?.refresh()
          }
        },
      }),
    },
  })
}

function editField(data: Data, field: keyof Data, title: string, inputType: 'text' | 'password' | 'textarea' = 'text') {
  const hideValue = field === 'platformPassword' && !check(PlatformPermissionCode.ViewPassword)
  showSimpleDialog({
    title,
    inputs: [
      {
        type: inputType,
        name: field,
        value: hideValue ? '' : data?.[field],
        props: {
          placeholder: title,
          rows: inputType === 'textarea' ? 6 : undefined,
        },
      },
    ],
    onConfirm: async (formData: any) => {
      const payload = { ...data, [field]: formData[field]?.trim?.() ?? formData[field] }
      const { code, msg } = await API.platform.userMdfPlatformInfoCreate({ platformList: [payload] })
      onlyErrorToast(code, msg)
      if (code === 0)
        tableRef.value?.refresh()
    },
  })
}

function onCopyAccount(data: Data) {
  copyText(formatAccountCopyText(data, check(PlatformPermissionCode.ViewPassword)))
  showToast(0, $t('已复制'))
}

function onRemark(data: Data) {
  const { promise, resolve } = Promise.withResolvers<void>()

  showSimpleDialog({
    title: $t('为所选账号添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'platformRemarks',
        value: data?.platformRemarks,
        props: {
          placeholder: $t('请输入备注'),
          rows: 6,
        },
      },
    ],
    onConfirm: async (formData: any) => {
      const datas = ([] as Data[]).concat(data).map(item => ({ ...item, platformRemarks: formData.platformRemarks }))
      const { code, msg } = await API.platform.userMdfPlatformInfoCreate({ platformList: datas, requestType: PlatformReqType.EditRemark })
      onlyErrorToast(code, msg)
      tableRef.value?.refresh()
    },
    onHide: resolve,
  })

  return promise
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

function togglePasswordVisible(id: string, cache: Record<string, any>) {
  if (Reflect.has(cache.visible, id)) {
    Reflect.deleteProperty(cache.visible, id)
  }
  else {
    Reflect.set(cache.visible, id, true)
  }
}

function bindProfiles(data: Data) {
  drawerInstance.showDrawer({
    title: $t('选择窗口'),
    slots: {
      container: () => h(ProfileSelect, {
        linkedWindowSortNums: parseWindowInfo(data.window_info),
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: async (profiles: any[]) => {
          if (!data.id)
            return
          const { code, msg } = await API.window.userMdfPlatformBindWindowCreate({
            platformId: data.id,
            windowIds: profiles.map(item => item.id),
          })
          onlyErrorToast(code, msg)
          if (code === 0)
            tableRef.value?.refresh()
        },
      }),
    },
  })
}

function exportAccounts() {
  const data = tableSelection.value.length ? tableSelection.value : exportData.value
  dialog.open(ExportAccounts, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        data,
        workspaceName: workspaceName.value,
        canViewPassword: canViewPassword.value,
      },
    },
  })
}

function deletePopup(data: any) {
  const { promise, resolve } = Promise.withResolvers<void>()
  const datas = [].concat(data)
  confirm.require({
    header: $t('删除平台账号'),
    message: $t('您确认要删除所选平台账号吗？删除后，将会与所有绑定的窗口解绑，但已有的登陆状态不会丢失'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      const { code, msg } = await API.platform.userDelPlatformInfoCreate({ ids })
      onlyErrorToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
      }
      resolve()
    },
    reject: resolve,
    onHide: resolve,
  })
  return promise
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader :title="($route.meta.title as string)">
      <RxButton v-if="canEdit && check(PlatformPermissionCode.Add)" size="xxs" icon="base/rx_ic_add_keys" :label="$t('添加账号')" @click.stop="createAccount" />
    </ViewsHeader>
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="account" v-model:columns="columns" v-model:selection="tableSelection" cache-key="account-list" selection-mode="multiple" class="account-table" :table-request="tableRequest"
               :operation="canEdit ? operation : []" :operation-handler="operationHandler" :virtual-scroller-options="{ itemSize: 60 }" :show-gridlines="false" :show-actions="false" :context-menu="canEdit"
      >
        <template #display-before>
          <RxButton v-if="canBatchExport" severity="secondary" outlined size="xxs" icon="base/rx_ic_export" :label="$t('导出数据')" @click.stop="exportAccounts" />
        </template>
        <template #filter-after>
          <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        </template>
        <template #table-empty>
          <CustomNewEmpty icon="base/rx_ic_keys" img="empty-accounts.png" :title="$t('暂无平台账号')" :desc="$t('在此添加平台账号以管理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton v-if="canEdit && check(PlatformPermissionCode.Add)" outlined severity="secondary" size="md" icon="base/rx_ic_add_keys" :label="$t('添加账号')"
                          @click.stop="operationHandler({ name: 'create' })"
                />
                <TutorialVideo video-type="account_management" :autoplay="false" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>
        <template #platformInfo="{ data }">
          <PlatformInfoCell :data="data" :readonly="isViewer" @click.stop="() => !isViewer && editAccount(data)" />
        </template>
        <template #userName="{ data }">
          <AccountFieldCell :value="data.platformUserName" show-copy :show-edit="canEdit" @edit="editField(data, 'platformUserName', $t('修改账号'), 'textarea')" />
        </template>
        <template #password="{ data, column: { _cache } }">
          <AccountFieldCell :value="data.platformPassword" :masked="!canViewPassword || !_cache.visible[data.id]" show-masked :show-copy="canViewPassword"
                            :show-edit="canEdit && check(PlatformPermissionCode.Edit)" @edit="editField(data, 'platformPassword', $t('修改密码'), 'textarea')" @toggle-masked="togglePasswordVisible(data.id, _cache)"
          />
        </template>
        <!-- <template #email="{ data }">
          <AccountFieldCell :value="data.platformEmail" show-copy :show-edit="canEdit" @edit="editField(data, 'platformEmail', $t('修改关联邮箱'), 'textarea')" />
        </template> -->
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header w-full">
            <span>{{ title }}</span>
            <SvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
                     @click.stop="toggleRemarkDisplayStatus(_cache)"
            />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" :class="{ 'cursor-pointer': canEdit }" @click.stop="canEdit && operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.platformRemarks, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.platformRemarks }" text severity="secondary" size="xxs"
                      :icon="data.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div v-if="_cache.extend" :title="data.platformRemarks" class="min-w-50 whitespace-pre-wrap note-content">
              {{ data.platformRemarks }}
            </div>
          </div>
        </template>
        <template #related="{ data }">
          <RelatedProfilesCell :list="getRelatedProfileLabels(data)" :show-add="canEdit && check('Profiles_select_platform')" @add="bindProfiles(data)" />
        </template>
        <template v-if="canEdit" #actions="{ data }">
          <div class="flex gap-2 items-center">
            <Actions :operation="operation" :show-menu="false" @quick-click="(operate: any) => operationHandler(operate, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.account-table) {
  tr:not([data-p-selected='true']):hover .row-hover-action,
  tr:not([data-p-selected='true']):focus-within .row-hover-action {
    opacity: 1;
  }

  tr:not([data-p-selected='true']):hover .row-hover-empty,
  tr:not([data-p-selected='true']):focus-within .row-hover-empty {
    display: none;
  }
}

.note {
  &-header {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
  }

  &-content {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
    line-height: 1.4;
  }

  &-light {
    :deep(svg) {
      color: var(--colors-text-text-brand, #11a3fd) !important;
    }
  }
}
</style>
