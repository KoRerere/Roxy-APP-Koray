<script setup lang="tsx">
import type { UnwrapRowType, UserGetPluginListListData } from '@roxy/backend-api'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon,  } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { ExtensionsInstallType, ExtensionsSource, extensionsSourceFormat, ExtensionsStatus, PluginSwitchType } from '/@/enums'
import { setColumns } from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import installExtension from '/@/views/extensions/install/components/install-extension.vue'
import uploadExtension from '/@/views/extensions/install/components/upload-extension.vue'
import { usePopoverMenu } from '/@/views/browser/list/profiles/components/popover-menu'

type Data = UnwrapRowType<UserGetPluginListListData>

defineEmits(['search'])
const confirm = useConfirm()
const dialog = useDialog()
const toast = useToast()
const role = useRoleStore()

const [dialogOpen] = useSimpleDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [show] = useContextMenu()
const [showMenu] = usePopoverMenu()


const needsync = defineModel('needsync')
const tableRef = useTemplateRef('extable')

const columns = setColumns([
  {
    title: $t('扩展信息'),
    key: 'extension',
    slot: 'extension',
  },
  {
    title: $t('来源'),
    key: 'source',
    getText: (row: any) => extensionsSourceFormat(row.source) || $t('未知'),
  },
  {
    title: $t('扩展归属'),
    key: 'pluginSwitchType',
    slot: 'pluginSwitchType',
  },
  {
    title: $t('已安装项目'),
    key: 'related',
    slot: 'related',
  },
  {
    title: $t('更新信息'),
    key: 'pluginUpdateState',
    slot: 'update',
  },
  {
    title: $t('操作'),
    style: 'width: 9rem',
    slot: 'actions',
  },
])

const filters = reactive({
  value: undefined,
  options: [
    {
      name: $t('全部'),
      value: undefined,
    },
    {
      name: $t('团队'),
      value: PluginSwitchType.team,
    },
    {
      name: $t('个人'),
      value: PluginSwitchType.personal,
    },
  ],
  onChange() {
    tableRef.value?.refresh({ pluginSwitchType: filters.value })
    needsync.value = true
  },
  resetFilters() {
    filters.value = undefined
    filters.onChange()
  },
})


const pinMenus = [
{
      label: $t('自定义'),
      value: 'customize',
    },
{
      label: $t('始终固定到工具栏'),
      value: 'pin',
    },
{
      label: $t('始终不固定到工具栏'),
      value: 'unpin',
    },
]

async function tableRequest(params: any) {
  return API.plugins.userGetPluginListList(params)
}

async function showPinMenu(event: any, data: any) {
  if (!(role.isOwner || role.isManager))
    return

  showMenu(event, {
    type: 'radio',
    value: data.fixedPlugin,
    operation: pinMenus,
    onHide: async (fixedPlugin: string) => {
      if (fixedPlugin !== data.fixedPlugin) {
       await API.plugins.userFixedPluginToWindowCreate({ id: data.id, fixedPlugin })
       data.fixedPlugin = fixedPlugin
      }
    },
    beforeCmp: () => {
      return <div class="pl-4 pt-2">{$t('固定方式')}</div>
    },
  })
}

function tableOperation(data: any) {
  const datas = [].concat(data)
  const isPersonal = !datas.some((data: any) => data.pluginSwitchType !== PluginSwitchType.personal)

  return [
    {
      name: 'checkUpdate',
      label: $t('检查更新'),
      icon: 'base/rx_ic_clock_rotate',
      power: isPersonal || role.isOwner || role.isManager,
    },
    data.source === 'local' && {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: isPersonal || role.isOwner || role.isManager,
    },
    {
      separator: true,
      power: isPersonal || role.isOwner || role.isManager,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      disabled: datas.some((data: any) => !data.canDelete),
      disabledTooltip: $t('选项中包含其他人的插件'),
      power: isPersonal || role.isOwner || role.isManager,
      multiple: true,
      multipleProps: {
        name: 'one',
      },
    },
  ].filter(Boolean)
}

async function operationHandler(operate: any, data: any) {
  const datas = [].concat(toRaw(data))

  switch (operate.name) {
    case 'install':
      onInstall(data)
      break
    case 'updateLocal':
      break
    case 'checkUpdate':
      checkUpdate(data)
      break
    case 'edit':
      onUploadExtension(data)
      break
    case 'delete':
      deleteExtension(datas)
      break
  }
}

async function uploadRecordCheck() {
  const { data } = await API.plugins.userRecordPluginUploadV2List()
  if (data) {
    return Promise.resolve()
  }
  else {
    throw new Error($t('您当日的扩展上传数量已达上限'))
  }
}

function installViaUrl() {
  dialogOpen({
    props: {
      title: $t('添加 Google 扩展'),
      content: $t('每日总扩展添加数量限制为 5 个。'),
      inputs: [
        {
          type: 'text',
          placeholder: $t('请输入 Google Store 中扩展的 URL'),
          name: 'url',
          leftIcon: 'base/rx_ic_link',
        },
      ],
    },
    onConfirm: async (formData: any) => {
      try {
        await uploadRecordCheck()
        const { code, data, msg }: any = await API.plugins.userUploadChromePluginsV2Create(formData)
        onlyErrorToast(code, msg)
        if (code === 0) {
          filters.resetFilters()
          const plugin = await getExtensionDetail(data.plugin_id)
          onInstall(plugin)
        }
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
    },
  })
}

function onUploadExtension(data = {}) {
  const {pluginDir,localKey} = data

  dialog.open(uploadExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      localKey,
      pluginDir,
      onConfirm: async (params: any) => {
        try {
          await uploadRecordCheck()
          params.pluginDir = pluginDir || params.pluginDir
          const { code, data, msg } = await API.plugins.userUploadPluginInfoCreate(params)

          onlyErrorToast(code, msg)
          if (code === 0) {
            filters.resetFilters()
            const plugin = await getExtensionDetail(data.plugin_id)
            pluginDir || onInstall(plugin)
          }
        }
        catch (error) {
          console.log(error)
        }
      },
    },
  })
}

async function onInstall(data: Data) {
  dialog.open(installExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: data,
      onConfirm: async (params: any) => {
        try {
          const { code, msg } = await API.plugins.userAddPluginToWindowCreate({ ...params, pluginId: data.id })
          if (code === 0) {
            window.electronAPI.send('extension:download', [toRaw(data) as any])
          }
          showToast(code, msg)
          tableRef.value?.refresh({ pluginSwitchType: filters.value })
        }
        catch (error) {
          console.log(error)
        }
      },
    },
  })
}

async function getExtensionDetail(pluginId: number) {
  const { data: { rows: [plugin] } } = await API.plugins.userGetPluginInfoByIdList({ pluginId })
  return plugin
}

async function checkUpdate(data: Data) {
  await API.plugins.userCheckAllPluginsVersionList({ pluginDir: data.pluginDir as string })
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('检查更新完成'), life: 2500 })
  filters.onChange()
}

async function updateExtension(data: any) {
  await API.plugins.userUpgradePluginsCreate(data)
  filters.resetFilters()
}

async function deleteExtension(datas: Data[]) {
  confirm.require({
    header: $t('删除扩展'),
    message: $t('您确认要删除所选扩展吗？删除后，所有已关联项目中的窗口扩展将被移除。'),
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
      try {
        const ids = datas.map(item => item.id as number)
        const { code, msg } = await API.plugins.userBatchDelPluginInfoCreate({ ids })
        onlyErrorToast(code, msg)
        if (code === 0) {
          filters.resetFilters()
          electronAPI.send('extension:remove', datas.map(item => item.pluginDir!))
        }
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
    },
  })
}

function showOperationMenu({ event, operation }: { event: Event, operation: any }, data: any) {
  show(event, {
    operation,
    operationHandler: (operate: any) => operationHandler(operate, data),
  })
}

defineExpose({
  refresh: () => {
    tableRef.value?.refresh({ pluginSwitchType: filters.value })
  },
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="extable" scrollable selection-mode="multiple" :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns"
    :show-display="false" :show-gridlines="false" :show-actions="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <RxSelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
        <div class="group-button">
          <RxButton severity="info" size="xxs" icon="base/rx_ic_download_cloud" :label="$t('添加 Google 扩展')" @click="installViaUrl" />
          <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_export" :label="$t('本地上传')" @click="onUploadExtension()" />
        </div>
      </div>
    </template>

    <template #table-empty>
      <CustomEmpty icon="rx_illustration_extension.svg" :title="$t('暂无扩展')" :desc="$t('在此添加扩展以管理，并更方便地与窗口或项目进行绑定。')">
        <template #extra>
          <div class="flex items-center gap-3">
            <RxButton v-if="role.isOwner || role.isManager" outlined severity="secondary" size="xs" icon="base/rx_ic_magnify" :label="$t('搜索扩展')" @click="$emit('search')" />
            <!-- <RxButton text severity="secondary" size="xs" :label="$t('扩展文档')" /> -->
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #extension="{ data }">
      <div class="flex items-center gap-3 w-75">
        <img class="extension-image" :src="data.pluginIcon">
        <div class="flex flex-col justify-center items-start w-full extension-info">
          <div class="w-full ellipsis-1 extension-info-name">
            {{ data.pluginName }}
          </div>
          <div class="extension-info-version">
            v{{ data.pluginVersion }}
          </div>
        </div>
      </div>
    </template>

    <template #pluginSwitchType="{ data }">
      <div class="plugin-switch-type">
        <span v-if="data.pluginSwitchType === PluginSwitchType.personal">{{ $t('个人') }}</span>
        <span v-else>
          <span>{{ $t('团队') }}</span>
          <RxSvgIcon v-tooltip.top="{ value: `${data.userName}\n${data.email}`, showDelay: 500 }" class="ml-1" name="base/rx_ic_info" :size="12" color="#C7CDD1" />
        </span>
      </div>
    </template>

    <template #related="{ data }">
      <div v-if="data.pluginSwitchType === PluginSwitchType.personal || role.isOwner || role.isManager" @click="operationHandler({ name: 'install' }, data)">
        <!-- <RxTag v-if="Number(data.installType) === ExtensionsInstallType.all" icon="base/rx_ic_stack_full" :label="$t('全部安装')" /> -->
        <RelatedInfo class="cursor-pointer" icon="base/rx_ic_stack" :list="data.bindPlugin">
          <template #empty>
            <div class="flex items-center gap-1.5">
              <RxTag class="cursor-pointer" icon="base/rx_ic_stack" />
              <span class="not-installed">{{ $t('尚未安装') }}</span>
            </div>
          </template>
        </RelatedInfo>
      </div>
      <div v-else>
        --
      </div>
    </template>

    <template #update="{ data }">
      <div v-if="data.pluginUpdateState === ExtensionsStatus.update" class="flex items-center gap-3">
        <RxButton severity="success" icon="base/rx_ic_renew" :label="$t('更新')" size="xxs" @click="updateExtension(data)" />
        <RxSvgIcon v-tooltip.top="{ value: `latest: ${data.pluginNewVersion}`, showDelay: 500 }" name="base/rx_ic_info" color="#C7CDD1" />
      </div>
      <div v-else class="update-info">
        --
      </div>
    </template>

    <template #actions="{ data }">
      <div v-if="data.pluginSwitchType === PluginSwitchType.personal || role.isOwner || role.isManager" class="flex items-center">
        <div class="cursor-pointer mr-2" @click="showPinMenu($event,data)">
          <RxSvgIcon :name="data.fixedPlugin === 'pin' ? 'base/rx_ic_pin_solid_02' : 'base/rx_ic_pin_line_02'" :class="{pinned: data.fixedPlugin === 'pin'}" class="block pointer-events-none"/>
        </div>
        <Actions :operation="tableOperation(data)" @more="showOperationMenu($event, data)" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.group-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
}

.extension {
  &-image {
    padding: var(--spacing-md, 6px);
    width: 36px;
    aspect-ratio: 1;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-body, #fff);
  }

  &-info {
    gap: var(--spacing-sm, 4px);
    line-height: var(--Line-Height-text-xs, 16px);
    font-weight: 500;

    &-name {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 13px;
    }

    &-version {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: 'JetBrains Mono';
      font-size: 12px;
    }
  }
}

.plugin-switch-type,
.update-info {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;

  // &:hover {
  //   color: var(--Colors-Text-text-brand, #12a3fc);
  // }
}

.not-installed {
  color: var(--Colors-Text-text-inactive, #a3a9ad);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.pinned {
  color: var(--Colors-Text-text-brand, #12a3fc);
}
</style>
