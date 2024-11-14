<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { extensionsSourceFormat, ExtensionsStatus } from '/@/enums'
import { setColumns } from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import installExtension from '/@/views/extensions/install/components/install-extension.vue'
import uploadExtension from '/@/views/extensions/install/components/upload-extension.vue'

defineEmits(['search'])
const confirm = useConfirm()
const dialog = useDialog()
const toast = useToast()
const role = useRoleStore()

const [dialogOpen] = useSimpleDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [show] = useContextMenu()

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
    key: 'pluginType',
    getText: (row: any) => row.pluginType ? $t('个人') : $t('团队'),
  },
  {
    title: $t('已关联项目'),
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
], {
  filters: role.isOwner ? [] : ['related'], // 非所有者过滤关联信息
})

const filters = reactive({
  value: null,
  options: [
    {
      name: $t('全部'),
      value: null,
    },
    {
      name: $t('已启用'),
      value: true,
    },
    {
      name: $t('未启用'),
      value: false,
    },
  ],
  onChange() {
    tableRef.value?.refresh({ status: filters.value })
    needsync.value = true
  },
  resetFilters() {
    filters.value = null
    filters.onChange()
  },
})

async function tableRequest(params: any) {
  const data = await API.plugins.userGetPluginListList({ ...params, page_index: 1, page_size: 999 })
  data.data.rows = data.data.rows.map(item => ({ ...item, bindPlugin: item.bindPlugin.map((projectName: string) => projectName === '无项目' ? $t('无项目') : projectName) }))
  return data
}

function tableOperation(data: any) {
  return [
    {
      name: 'checkUpdate',
      label: $t('检查更新'),
      icon: 'base/rx_ic_clock_rotate',
      power: data.pluginType || role.isOwner,
    },
    {
      separator: true,
      power: data.pluginType || role.isOwner,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      multiple: true,
      power: data.pluginType || role.isOwner,
    },
  ]
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
    case 'setting':
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
        const { code, msg }: any = await API.plugins.userUploadChromePluginsV2Create(formData)
        showToast(code, msg)
        if (code === 0) {
          filters.resetFilters()
        }
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
    },
  })
}

function onUploadExtension() {
  dialog.open(uploadExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      onConfirm: async (params: any) => {
        try {
          await uploadRecordCheck()
          await API.plugins.userUploadPluginInfoCreate(params)
          filters.resetFilters()
        }
        catch (error) {
          console.log('🚀 ~ onConfirm: ~ error:', error)
        }
      },
    },
  })
}

async function onInstall(data: any) {
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
          const { code, msg } = await API.plugins.userAddPluginToWindowCreate(params)
          if (code === 0) {
            window.electronAPI.send('extension:download', [toRaw(data)])
          }
          showToast(code, msg)
          tableRef.value?.refresh({ status: filters.value })
        }
        catch (error) {
          console.log('🚀 ~ onConfirm: ~ error:', error)
        }
      },
    },
  })
}

async function checkUpdate(data: any) {
  await API.plugins.userCheckAllPluginsVersionList({ pluginDir: data.pluginDir })
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('检查更新完成'), life: 2500 })
  filters.onChange()
}

async function updateExtension(data: any) {
  await API.plugins.userUpgradePluginsCreate(data)
  filters.resetFilters()
}

async function deleteExtension(datas: any) {
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
        const ids = datas.map((item: any) => item.id)
        const { msg } = await API.plugins.userBatchDelPluginInfoCreate({ ids })

        toast.add({ severity: 'success', summary: $t('操作成功'), detail: msg, life: 2500 })
        filters.resetFilters()
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
    tableRef.value?.refresh({ status: filters.value })
  },
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="extable" scrollable selection-mode="multiple" :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns"
    :show-display="false" :show-gridlines="false" :paginator="false" :show-actions="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <!-- <RxSelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value" data-key="value" @change="filters.onChange" /> -->
        <div class="group-button">
          <RxButton severity="info" size="xxs" icon="base/rx_ic_download_cloud" :label="$t('添加 Google 扩展')" @click="installViaUrl" />
          <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_export" :label="$t('本地上传')" @click="onUploadExtension" />
        </div>
      </div>
    </template>

    <template #table-empty>
      <CustomEmpty icon="empty/rx_illustration_extension.svg" :title="$t('暂无扩展')" :desc="$t('在此添加扩展以管理，并更方便地与窗口或项目进行绑定。')">
        <template #extra>
          <div class="flex items-center gap-3">
            <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_magnify" :label="$t('搜索扩展')" @click="$emit('search')" />
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

    <template #related="{ data }">
      <RelatedInfo class="cursor-pointer" icon="base/rx_ic_stack" :list="data.bindPlugin" @click="operationHandler({ name: 'install' }, data)">
        <template #empty>
          <RxTag class="cursor-pointer" icon="base/rx_ic_stack" />
        </template>
      </RelatedInfo>
    </template>

    <template #update="{ data }">
      <div v-if="data.pluginUpdateState === ExtensionsStatus.update" class="flex items-center gap-3">
        <RxButton :label="$t('更新')" size="sm" @click="updateExtension(data)" />
        <RxSvgIcon v-tooltip.top="{ value: `latest: ${data.pluginNewVersion}`, showDelay: 500 }" name="base/rx_ic_info" />
      </div>
      <div v-else>
        --
      </div>
    </template>

    <template #actions="{ data }">
      <Actions v-if="data.pluginType || role.isOwner" :operation="tableOperation(data)" @more="showOperationMenu($event, data)" />
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
</style>
