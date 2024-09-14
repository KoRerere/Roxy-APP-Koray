<script setup lang="ts">
// import { useConfirm } from 'primevue/useconfirm'
// import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
// import bottonBox from './components/buttonBox.vue'

import selectBotton from './components/selectBotton.vue'

import uploadDialog from './components/uploadDialog.vue'
import { API } from '/@/api'

import ryTable from '/@/components/ry-table'

defineOptions({
  inheritAttrs: false,
})

// const toast = useToast()
// const dialog = useDialog()
const toast = useToast()
const tableRef = ref()
const operation = ref([
  {
    name: 'edit',
    label: '编辑',
    icon: 'base/rx_ic_edit',
    quick: true,
  },
  {
    name: 'note',
    label: '笔记',
    icon: 'mdi mdi mdi-cube-scan',
    quick: true,
    multiple: true,
  },
  {
    name: 'delete',
    label: '删除',
    icon: 'mdi mdi-delete-empty-outline',
    quick: true,
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
    slot: 'source',
  },

  {
    title: 'Last Update',
    key: 'lastupdate',
    slot: 'lastupdate',
  },

  {
    title: 'Update Info',
    key: 'updateinfo',
    getText: (row: any) => row.pluginUpdateState || '--',
  },
])

const dataLists = ref()

const isInstallPopVisible = ref(false)

const uploadPop = ref(true)

function openUploadPop() {
  uploadPop.value = true
}

/**
 * 提交url
 */
function handleSubmitInstall(val: string) {
  // 正则校验url，确保URL格式正确
  const urlRegex = /^(?:http|https):\/\/[^ "]+$/
  if (!urlRegex.test(val ?? '')) {
    toast.add({ severity: 'warn', summary: '警告', detail: 'Invalid URL format', life: 5000 })
    return
  }
  const params = {
    url: val,
  }
  handleInstall(params)
}

/**
 * 请求提交url接口
 */
async function handleInstall(params: any) {
  const { code } = await API.plugins.userUploadChromePluginsCreateV2(params)
  if (code === 0) {
    // TODO 刷新列表
    tableRef.value.refresh()
  }
}

onMounted(() => {
  // getUserExtensionList({})
  getUserExtensionList({})
})

/**
 * 用户开启或关闭插件
 */
async function handleSwitch(item: any) {
  console.log(item)
  const params = {
    id: item.id,
    useStatus: item.useStatus === false,
  }
  const { code, msg } = await API.plugins.userMdfPluginStatusCreate(params)
  if (code === 0) {
    toast.add({ severity: 'success', summary: '操作成功', life: 5000 })
  }
  else {
    toast.add({ severity: 'error', summary: '失败', detail: msg, life: 5000 })
  }
}

watch(() => dataLists.value, (newValue) => {
  // console.log(dataList.value)
  dataLists.value = newValue
})

/**
 * 根据选择事件触发
 */
function selectFunc(e: any) {
  const params = {
    status: e === 'Active',
  }
  if (e === 'All') {
    // 删除属性
    delete params.status
  }
  tableRef.value.refresh(params)
}

/**
 * 本地上传插件请求
 */
// async function uploadLocalPlugin(params: any) {
//   const { data } = await API.plugins.userUploadPluginInfoCreate(params)
// }

/**
 * 请求user插件列表数据
 */
async function getUserExtensionList(params: any) {
  const data = await API.plugins.userGetPluginListList(params)
  dataLists.value = data.data.rows
  return data
}
// ======================================

function installViaUrl() {

}
</script>

<template>
  <uploadDialog :upload-pop="true" />
  <!-- <installDialog :is-install-pop-visible="isInstallPopVisible" @click-install-cancel-btn="clickInstallCancelBtn"
    @handle-submit-install="handleSubmitInstall" /> -->
  <ry-table ref="tableRef" scrollable selection-mode="multiple" :operation="operation"
    :table-request="getUserExtensionList" :columns="columns" :show-gridlines="false">
    <template #header-extra>
      <div class="flex items-center justify-between w-full">
        <selectBotton @select-func="selectFunc" />
        <!-- <bottonBox @open-install-pop="openInstallPop" @open-upload-pop="openUploadPop" /> -->
        <div class="group-button">
          <ryButton severity="info" size="small" icon="base/rx_ic_download_cloud" label="Install via URL"
            @click="installViaUrl" />
          <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_export" label="Upload" />
          <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_clock_rotate" label="Update All" />
        </div>
      </div>
    </template>
    <template #extension="{ data }">
      <div>{{ data.pluginName }}</div>
    </template>

    <template #toggle="{ data }">
      <div>
        <ToggleSwitch v-model="data.useStatus" @change="handleSwitch(data)" />
      </div>
    </template>

    <template #source="{ data }">
      <div>{{ data.source }}</div>
    </template>

    <template #lastupdate="{ data }">
      <div>{{ data.lateUpdateTime }}</div>
    </template>

    <template #updateinfo="{ data }">
      <div>{{ data.pluginUpdateState }}</div>
    </template>
  </ry-table>
</template>

<style lang="scss" scoped>
.group-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
}
</style>

<style lang="scss" scoped>
.install-mask {
  // position: fixed;
  // top: 0;
  // left: 0;
  // background: var(--Colors-Alpha-alpha-black-20, rgba(0, 0, 0, 0.20));
  // z-index: 8;
  // display: flex;
  // align-items: center;
  // justify-content: center;

  .install-via-box {
    display: flex;
    width: var(--width-sm, 480px);
    padding: var(--spacing-4xl, 24px);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2xl, 16px);
    border-radius: 6px;
    border: 0.5px solid var(--Color-neutrals-400, #a3a9ad);
    background: #fff;
    box-shadow:
      0px 1px 1px 0px rgba(0, 0, 0, 0.04),
      0px 2px 8px 0px rgba(0, 0, 0, 0.04),
      0px 3px 17px 0px rgba(0, 0, 0, 0.04),
      0px 4px 30px 0px rgba(0, 0, 0, 0.12);

    transform: translate(0, -50%);

    &-title {
      color: #000;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
    }

    &-desc {
      color: var(--Color-neutrals-600, #575d61);
      font-family: Inter;
      margin-bottom: var(--spacing-xl, 12px);
      /* 150% */
    }

    .install-via-input {
      display: flex;
      padding: 8px 8px 8px 10px;
      align-items: center;
      gap: var(--spacing-md, 6px);
      align-self: stretch;
      border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
      border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
      background: var(--Component-Colors-TextInput-bg-bg, #fff);
      box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
    }

    .install-via-btn {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;

      .install-via-btn-install {
        display: flex;
        min-width: 24px;
        padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
        justify-content: center;
        align-items: center;
        gap: var(--spacing-sm, 4px);
        border-radius: var(--radius-sm, 4px);
        border: 0.5px solid var(--Component-Colors-Buttons-Primary-border, #0881cc);
        background: var(--Component-Colors-Buttons-Primary-bg, #12a3fc);
        box-shadow:
          0px 4px 4px -1px rgba(0, 0, 0, 0.02),
          0px 1px 1px 0px rgba(0, 0, 0, 0.06);
        color: var(--Component-Colors-Buttons-Primary-text, #fff);
        text-align: center;
        font-family: Inter;
        font-size: var(--Font-Size-text-sm, 12px);
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
        cursor: pointer;
        /* 133.333% */
      }

      .install-via-btn-cancel {
        display: flex;
        min-width: 24px;
        padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
        justify-content: center;
        align-items: center;
        gap: var(--spacing-sm, 4px);
        border-radius: var(--radius-sm, 4px);
        color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
        text-align: center;
        font-family: Inter;
        font-size: var(--Font-Size-text-sm, 12px);
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
        cursor: pointer;
        /* 133.333% */
      }
    }
  }
}

.account {
  &-header {
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    gap: 10px;
    height: 48px;
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    height: calc(100% - 48px);
    overflow-y: auto;
  }
}

.platform {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
