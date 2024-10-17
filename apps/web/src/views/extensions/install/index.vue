<script setup lang="ts">
import type { ToastMessageOptions } from 'primevue/toast'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { ExtensionsInstallType, ExtensionsStatus } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import installExtension from '/@/views/extensions/install/components/install-extension.vue'
import uploadExtension from '/@/views/extensions/install/components/upload-extension.vue'

const confirm = useConfirm()
const dialog = useDialog()
const toast = useToast()
const role = useRoleStore()

const [dialogOpen] = useSimpleDialog()
const [showToast] = useResponseToast()
const needsync = defineModel('needsync')

const tableRef = useTemplateRef('extable')

const columns = ref([
  {
    title: $t('Extension'),
    key: 'extension',
    slot: 'extension',
  },
  {
    title: $t('Toggle'),
    key: 'toggle',
    getText: (row: any) => row.useStatus ? 'Active' : 'Disable',
    // slot: 'toggle',
  },
  {
    title: $t('Source'),
    key: 'source',
    getText: (row: any) => row.uploader || row.source || '未知',
  },
  {
    title: $t('Installed Profiles'),
    key: 'installType',
    getText: (row: any) => !row.installType
      ? '--'
      : Number(row.installType) === ExtensionsInstallType.all
        ? $t('Full')
        : $t('Partial'),
  },
  {
    title: $t('Update'),
    key: 'pluginUpdateState',
    slot: 'update',
  },
])

const filters = reactive({
  value: null,
  options: [
    {
      name: $t('All'),
      value: null,
    },
    {
      name: $t('Active'),
      value: true,
    },
    {
      name: $t('Disabled'),
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
    label: $t('Sorting rules'),
    placeholder: $t('Please select a sorting rule'),
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: $t('Create time'), value: 'createTime' },
      { label: $t('Update time'), value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: $t('Sort type'),
    placeholder: $t('Please select sort type'),
    name: 'orderType',
    value: 'desc',
    options: [
      { label: $t('Descending order'), value: 'desc' },
      { label: $t('Ascending order'), value: 'asc' },
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
      name: 'updateLocal',
      label: $t('Update local'),
      icon: 'base/rx_ic_clock_rotate',
      power: data.source === 'local' && !role.isViewer,
    },
    {
      name: 'checkUpdate',
      label: $t('Check update'),
      icon: 'base/rx_ic_clock_rotate',
      power: data.source !== 'local' && !role.isViewer,
    },
    // {
    //   name: 'setting',
    //   label: 'Setting',
    //   icon: 'base/rx_ic_gear',
    //   multiple: true,
    // },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: $t('Delete'),
      icon: 'base/rx_ic_bin_1',
      multiple: true,
      power: role.isOwner || role.isManager,
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
      title: $t('Install via Chrome Store'),
      content: $t('Please paste the chrome extension URL down below then click the install button.'),
      inputs: [
        {
          type: 'text',
          placeholder: $t('Extension URL'),
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
        toast.add({ severity, summary, detail: msg, life: 5000, group: 'tc' })

        if (code === 0) {
          filters.resetFilters()
        }
      }
      catch (error) {
        toast.add({ severity: 'warn', summary: $t('Warn'), detail: error, life: 5000, group: 'tc' })
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

async function onSwitch(item: any) {
  const { code, msg } = await API.plugins.userMdfPluginStatusCreate(item)
  const [severity, summary]: [ToastMessageOptions['severity'], string] = code === 0 ? ['success', $t('Success')] : ['error', $t('Error')]
  toast.add({ severity, summary, detail: msg, life: 5000, group: 'tc' })
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
          showToast(code, msg, 5000)
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
  toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Check completed'), life: 5000 })
  filters.onChange()
}

async function updateExtension(data: any) {
  await API.plugins.userUpgradePluginsCreate(data)
  filters.resetFilters()
}

async function deleteExtension(datas: any) {
  confirm.require({
    header: $t('Warning'),
    message: $t('Are you sure you want to delete this plugin?'),
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Confirm'),
      severity: 'danger',
    },
    accept: async () => {
      try {
        const ids = datas.map((item: any) => item.id)
        const { msg } = await API.plugins.userBatchDelPluginInfoCreate({ ids })

        toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 5000 })
        filters.resetFilters()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
      }
    },
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
  <RyTable ref="extable" scrollable selection-mode="multiple" :table-operation="tableOperation"
           :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns" :sorts="sorts"
           :show-display="false" :show-gridlines="false" :paginator="false"
  >
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <SelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value"
                      data-key="value" @change="filters.onChange"
        />
        <div class="group-button">
          <RyButton severity="info" size="small" icon="base/rx_ic_download_cloud" :label="$t('Add with URL')"
                    @click="installViaUrl"
          />
          <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_export" :label="$t('Upload')"
                    @click="onUploadExtension"
          />
        </div>
      </div>
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
    <template #toggle="{ data }">
      <RxToggleSwitch v-model="data.useStatus" :label="data.useStatus ? $t('Active') : $t('Disable')"
                      @change="onSwitch(data)"
      />
    </template>

    <template #update="{ data }">
      <div v-if="data.pluginUpdateState === ExtensionsStatus.update" class="flex items-center gap-3">
        <RyButton :label="$t('Update')" size="small" @click="updateExtension(data)" />
        <RxSvgIcon v-tooltip.top="{ value: `latest: ${data.pluginNewVersion}`, showDelay: 500 }"
                   name="base/rx_ic_info"
        />
      </div>
      <div v-else>
        --
      </div>
    </template>

    <template #actions-extra="{ data }">
      <RyButton icon="base/rx_ic_install_extension" :label="$t('Install')" size="small" severity="secondary" text
                @click="operationHandler({ name: 'install' }, data)"
      />
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
    width: 32px;
    aspect-ratio: 1;
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
    width: 240px;

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
