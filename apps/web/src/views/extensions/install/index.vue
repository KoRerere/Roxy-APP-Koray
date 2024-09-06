<script setup lang="ts">
import { API } from '/@/api'
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import { useToast } from 'primevue/usetoast'

import bottonBox from './components/buttonBox.vue'
import selectBotton from './components/selectBotton.vue'

import { useDialog } from 'primevue/usedialog'
import { useConfirm } from 'primevue/useconfirm'

import installDialog from './components/installDialog.vue'
import uploadDialog from './components/uploadDialog.vue'

// const toast = useToast()
const dialog = useDialog()
const toast = useToast()
// const dataList = [
//   {
//     "id": 224,
//     "source": "sys",
//     "pluginDir": "cofbobkapfknpdllndaligcgmikmegbl",
//     "pluginName": "Premium Sender Plus",
//     "pluginIcon": "http://lumibrowser-test.oss-cn-shenzhen.aliyuncs.com/public/plugin/cofbobkapfknpdllndaligcgmikmegbl.png",
//     "pluginRoute": "http://lumibrowser-test.oss-cn-shenzhen.aliyuncs.com/public/plugin/cofbobkapfknpdllndaligcgmikmegbl.zip",
//     "pluginVersion": "1.1.74",
//     "pluginDesc": "Best Message Sending Extension.",
//     "provider": "Chrome Store",
//     "pluginUpdateState": 0,
//     "pluginNewVersion": "",
//     "useStatus": true,
//     "lateUpdateTime": "2024-09-04 17:16:05",
//     "canDelete": true,
//     "uploader": ""
//   },
//   {
//     "id": 223,
//     "source": "sys",
//     "pluginDir": "padekgcemlokbadohgkifijomclgjgif",
//     "pluginName": "Proxy SwitchyOmega",
//     "pluginIcon": "http://lumibrowser-test.oss-cn-shenzhen.aliyuncs.com/public/plugin/padekgcemlokbadohgkifijomclgjgif.png",
//     "pluginRoute": "http://lumibrowser-test.oss-cn-shenzhen.aliyuncs.com/public/plugin/padekgcemlokbadohgkifijomclgjgif.zip",
//     "pluginVersion": "2.5.21",
//     "pluginDesc": "Manage and switch between multiple proxies quickly & easily.",
//     "provider": "Chrome Store",
//     "pluginUpdateState": 0,
//     "pluginNewVersion": "",
//     "useStatus": true,
//     "lateUpdateTime": "2024-09-04 16:47:51",
//     "canDelete": true,
//     "uploader": ""
//   },
// ]

const operation = ref([
  {
    name: 'edit',
    label: '编辑',
    icon: 'mdi mdi-pencil-outline',
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

const dataList = ref()

let isInstallPopVisible = ref(false)

const uploadPop = ref(true)



// const props = defineProps({
//   dataList: {
//     type: Array,
//     default: () => []
//   }
// })


function openUploadPop() {
  uploadPop.value = true
}

function closeUploadPop() {
  uploadPop.value = false
}


// 提交url
function handleSubmitInstall(val: string) {
  // 正则校验url，确保URL格式正确
  const urlRegex = /^(http|https):\/\/[^ "]+$/;
  if (!urlRegex.test(val ?? '')) {
    toast.add({ severity: 'warn', summary: '警告', detail: "Invalid URL format", life: 5000 })
    return;
  }
  const params = {
    url: val
  }
  handleInstall(params)
}

// 请求提交url接口
async function handleInstall(params: any) {
  const { code, msg } = await API.plugins.userUploadChromePluginsCreateV2(params)
  if (code == 0) {
    // TODO 刷新列表
    getUserExtensionList({})
  }
}


// 打开安装弹窗
function openInstallPop() {
  isInstallPopVisible.value = true;
}

function clickInstallCancelBtn() {
  isInstallPopVisible.value = false;
}

// 用户开启或关闭插件
async function handleSwitch(item: any) {
  console.log(item)
  const params = {
    id: item.id,
    useStatus: item.useStatus == false ? true : false
  }
  const { code, msg } = await API.plugins.userMdfPluginStatusCreate(params)
  if (code == 0) {
    toast.add({ severity: 'success', summary: '操作成功', life: 5000 })
  } else {
    toast.add({ severity: 'error', summary: '失败', detail: msg, life: 5000 })
  }
}

watch(() => dataList.value, (newValue) => {
  // console.log(dataList.value)
  dataList.value = newValue
})

// 根据选择事件触发
function selectFunc(e: any) {
  const params = {
    status: e === "Active" ? true : false
  }
  if (e === 'All') {
    // 删除属性
    delete params.status
  }
  getUserExtensionList(params)
}

// 本地上传插件请求
async function uploadLocalPlugin(params: any) {
  const { data } = await API.plugins.userUploadPluginInfoCreate(params)
}

// 请求user插件列表数据
async function getUserExtensionList(params: any | {}) {
  const data = await API.plugins.userGetPluginListList(params)
  dataList.value = data.data.rows;
  return data
}

</script>





<template>
  <div>

    <uploadDialog :uploadPop="true"></uploadDialog>

    <!-- <Dialog modal :closable="false" :visible="installPop">
      <div class="font-semibold text-sm  mb-4">Install via Chrome Store</div>
      <div class="text-xs mb-2">Please paste the chrome extension URL down below then click the install
        <br />button.
      </div>
      <InputText class="w-full mb-4" v-model="installInputValue" placeholder="Extension URL" />
      <template #footer>
        <Button type="button" label="Install" @click="handleSubmitInstall"></Button>
        <Button severity="secondary" @click="closeIntallPop" text></Button>
      </template>
</Dialog> -->


    <installDialog :isInstallPopVisible="isInstallPopVisible" @clickInstallCancelBtn="clickInstallCancelBtn"
      @handleSubmitInstall="handleSubmitInstall">
    </installDialog>

    <div class="extension-content">
      <ry-table scrollable selection-mode="multiple" :operation="operation" :table-request="getUserExtensionList"
        :columns="columns" :show-gridlines="false">
        <template #header-extra>
          <div class="flex items-center justify-between w-full">
            <selectBotton @selectFunc="selectFunc"></selectBotton>
            <bottonBox @openInstallPop="openInstallPop" @openUploadPop="openUploadPop"></bottonBox>
          </div>
        </template>
        <template #extension="{ data }">
          <div>{{ data.pluginName }}</div>
        </template>

        <template #toggle="{ data }">
          <div>
            <ToggleSwitch @change="handleSwitch(data)" v-model="data.useStatus" />
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
    </div>
  </div>

</template>

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
    border: 0.5px solid var(--Color-neutrals-400, #A3A9AD);
    background: #FFF;
    box-shadow: 0px 1px 1px 0px rgba(0, 0, 0, 0.04), 0px 2px 8px 0px rgba(0, 0, 0, 0.04), 0px 3px 17px 0px rgba(0, 0, 0, 0.04), 0px 4px 30px 0px rgba(0, 0, 0, 0.12);

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
      color: var(--Color-neutrals-600, #575D61);
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
      border: 1px solid var(--Component-Colors-TextInput-border-border, #C7CDD1);
      background: var(--Component-Colors-TextInput-bg-bg, #FFF);
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
        border: 0.5px solid var(--Component-Colors-Buttons-Primary-border, #0881CC);
        background: var(--Component-Colors-Buttons-Primary-bg, #12A3FC);
        box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
        color: var(--Component-Colors-Buttons-Primary-text, #FFF);
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
        color: var(--Component-Colors-Buttons-Secondary-text, #171C1F);
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
