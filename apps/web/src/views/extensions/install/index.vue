<script setup lang="ts">
import type { ToastMessageOptions } from 'primevue/toast'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { ExtensionsStatus } from '/@/enums'
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
const [showToast] = useResponseToast()
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
    getText: (row: any) => row.uploader || row.source || $t('未知'),
  },
  {
    title: $t('扩展归属'),
    key: 'pluginType',
    getText: (row: any) => row.pluginType ? $t('个人') : $t('团队'),
  },
  {
    title: $t('已关联项目'),
    key: 'installType',
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
  filters: role.isOwner ? [] : ['installType'], // 非所有者过滤关联信息
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

const sorts = ref([
  {
    label: $t('排序标准'),
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: $t('添加时间'), value: 'createTime' },
      { label: $t('更新时间'), value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: $t('排序方式'),
    name: 'orderType',
    value: 'desc',
    options: [
      { label: $t('倒序'), value: 'desc' },
      { label: $t('正序'), value: 'asc' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
])

async function tableRequest(params: any) {
  return API.plugins.userGetPluginListList({ ...params, page_index: 1, page_size: 999 })// 不分页
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
    throw new Error($t('Your upload limit has been exhausted'))
  }
}

function installViaUrl() {
  dialogOpen({
    props: {
      title: $t('添加 Google 扩展'),
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
        const [severity, summary]: [ToastMessageOptions['severity'], string] = code === 0 ? ['success', $t('Installation successful')] : ['error', $t('Installation failed')]
        toast.add({ severity, summary, detail: msg, life: 2500 })

        if (code === 0) {
          filters.resetFilters()
        }
      }
      catch (error) {
        toast.add({ severity: 'warn', summary: $t('Warn'), detail: error, life: 2500 })
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
  toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Check completed'), life: 2500 })
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

        toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 2500 })
        filters.resetFilters()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
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
  <RyTable ref="extable" scrollable selection-mode="multiple" :table-operation="tableOperation" :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns" :sorts="sorts"
    :show-display="false" :show-gridlines="false" :paginator="false" :show-actions="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <RxSelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
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
            <RxButton text severity="secondary" size="xs" :label="$t('扩展文档')" />
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #extension="{ data }">
      <div class="extension">
        <img class="extension-image" :src="data.pluginIcon">
        <div class="extension-info">
          <div class="extension-info-name w-full ellipsis-1">
            {{ data.pluginName }}
          </div>
          <div class="extension-info-version">
            v{{ data.pluginVersion }}
          </div>
        </div>
      </div>
    </template>

    <template #related="{ data }">
      <RxTag class="cursor-pointer" icon="base/rx_ic_stack" @click="operationHandler({ name: 'install' }, data)" />
    </template>

    <template #update="{ data }">
      <div v-if="data.pluginUpdateState === ExtensionsStatus.update" class="flex items-center gap-3">
        <RxButton :label="$t('Update')" size="sm" @click="updateExtension(data)" />
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
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);

  &-image {
    padding: var(--spacing-md, 6px);
    width: 36px;
    aspect-ratio: 1;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-body, #fff);
  }

  &-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: var(--spacing-sm, 4px);
    font-style: normal;
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
