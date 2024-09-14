<script setup lang="ts">
// import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import type { SelectButtonChangeEvent } from 'primevue/selectbutton'

import type { ToastMessageOptions } from 'primevue/toast'

import { API } from '/@/api'

import ryTable from '/@/components/ry-table'
import { useSimpleDialog } from '/@/components/simplePopup'
import uploadExtension from '/@/views/extensions/install/components/upload-extension.vue'

// const toast = useToast()
const dialog = useDialog()
const toast = useToast()
const [dialogOpen] = useSimpleDialog()

const tableRef = useTemplateRef('extable')
const operation = ref([
  {
    name: 'checkUpdate',
    label: 'Check update',
    icon: 'base/rx_ic_clock_rotate',
  },
  {
    name: 'setting',
    label: 'Setting',
    icon: 'base/rx_ic_gear',
    multiple: true,
  },
  {
    separator: true,
  },
  {
    name: 'delete',
    label: 'Delete',
    icon: 'base/rx_ic_bin_1',
    multiple: true,
  },
])

const columns = ref([
  {
    title: 'Extension',
    key: 'extension',
    slot: 'extension',
  },
  {
    title: 'Toggle',
    key: 'toggle',
    slot: 'toggle',
  },
  {
    title: 'Source',
    key: 'source',
    getText: (row: any) => row.uploader || row.source || '未知',
  },
  {
    title: 'Last Update',
    key: 'lateUpdateTime',
  },
  {
    title: 'Update',
    key: 'pluginUpdateState',
    getText: (row: any) => row.pluginUpdateState || '--',
  },
])

const filters = reactive({
  value: null,
  options: [
    {
      name: 'All',
      value: null,
    },
    {
      name: 'Active',
      value: true,
    },
    {
      name: 'Disabled',
      value: false,
    },
  ],
  onChange({ value }: SelectButtonChangeEvent) {
    tableRef.value?.refresh({ status: value })
  },
})

const sorts = ref([
  {
    label: '排序规则',
    placeholder: '请选择排序规则',
    name: 'orderName',
    value: 'createTime',
    options: [
      { label: '创建时间', value: 'createTime' },
      { label: '更新时间', value: 'lateUpdateTime' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
  {
    label: '排序类型',
    placeholder: '请选择排序类型',
    name: 'orderType',
    value: 'desc',
    options: [
      { label: '降序', value: 'desc' },
      { label: '升序', value: 'asc' },
    ],
    icon: 'base/rx_ic_sort_ascending',
  },
])

async function tableRequest(params: any) {
  return API.plugins.userGetPluginListList({ ...params, page_index: 1, page_size: 999 })// 不分页
}

async function operationHandler(operate: any, data: any) {
  console.log('🚀 ~ operationHandler ~ operate:', operate.name)
  const datas = [].concat(data)

  switch (operate.name) {
    case 'install':
      break
    case 'checkUpdate':
      break
    case 'setting':
      break
    case 'delete':
      break
  }
}

function installViaUrl() {
  dialogOpen({
    props: {
      title: 'Install via Chrome Store',
      content: 'Please paste the chrome extension URL down below then click the install button.',
      inputs: [
        {
          type: 'text',
          placeholder: 'Extension URL',
          name: 'url',
          leftIcon: 'base/rx_ic_link',
          validator: (val: string) => {
            const urlRegex = /^(?:http|https):\/\/[^ "]+$/
            return urlRegex.test(val ?? '')
          },
        },
      ],
    },
    onConfirm: async (formData: any) => {
      const { data } = await API.plugins.userRecordPluginUploadList()
      if (data) {
        const { code, msg } = await API.plugins.userUploadChromePluginsV2Create(formData)
        const [severity, summary]: [ToastMessageOptions['severity'], string] = code === 0 ? ['success', '安装成功'] : ['error', '安装失败']
        toast.add({ severity, summary, detail: msg, life: 5000, group: 'tc' })

        if (code === 0) {
          tableRef.value.refresh()
        }
      }
      else {
        toast.add({ severity: 'warn', summary: '警告', detail: '您的上传次数已用完', life: 5000, group: 'tc' })
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
    data: {},
  })
}

async function onSwitch(item: any) {
  const { code, msg } = await API.plugins.userMdfPluginStatusCreate(item)
  const [severity, summary]: [ToastMessageOptions['severity'], string] = code === 0 ? ['success', '成功'] : ['error', '失败']
  toast.add({ severity, summary, detail: msg, life: 5000, group: 'tc' })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="extable" scrollable selection-mode="multiple" :operation="operation"
    :operation-handler="operationHandler" :table-request="tableRequest" :columns="columns" :sorts="sorts"
    :show-config="false" :show-gridlines="false" :paginator="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <SelectButton v-model="filters.value" :options="filters.options" option-label="name" option-value="value"
          data-key="value" @change="filters.onChange" />
        <div class="group-button">
          <ryButton severity="info" size="small" icon="base/rx_ic_download_cloud" label="Install via URL"
            @click="installViaUrl" />
          <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_export" label="Upload"
            @click="onUploadExtension" />
          <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_clock_rotate" label="Update All" />
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
      <div class="flex items-center gap-2">
        <ToggleSwitch v-model="data.useStatus" @change="onSwitch(data)" />
        <div>{{ data.useStatus ? 'Active' : 'Disable' }}</div>
      </div>
    </template>

    <template #actions-extra="{ data }">
      <ryButton icon="base/rx_ic_install_extension" label="Intall" size="small" severity="secondary" text
        @click="operationHandler({ name: 'install' }, data)" />
    </template>
  </ry-table>
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
    width: 200px;

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
