<script setup lang="tsx">
import { h } from 'vue'
import { format } from 'date-fns'
import { API } from '/@/api'

import { useWorkspaceStore } from '/@/stores/workspace'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import TransferHelp from '/@/views/browser/list/transfer/help.vue'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import RxAvatar from '/@/components/rx-avatar'
import { getWorkspaceAvatarProps, getWorkspaceNamePrefix } from '/@/utils/workspace'

const route = useRoute()
const router = useRouter()
const [showModal] = RxUseDialog()
const workspaceStore = useWorkspaceStore()
const workspaceName = computed(() => getWorkspaceNamePrefix(workspaceStore.currentWorkspace?.workspaceName)!)

function getWorkspaceAvatar(item: Record<string, any>) {
  return getWorkspaceAvatarProps({
    workspacePicture: item.workspacePicture,
    workspaceName: item.workspaceName,
    size: 24,
    emojiFontSize: 12,
    textFontSize: 14,
  })
}

const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '30%',
    },
  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
    style: {
      width: '10%',
    },
  },
  {
    title: $t('转移至'),
    key: 'transfer',
    slot: 'transfer',
    style: {
      width: '40%',
    },
  },
  ,
  {
    title: $t('转移发起时间'),
    key: 'createTime',
    getText: (row: any) => row.createTime ? format(new Date(row.createTime), 'yyyy/MM/dd HH:mm:ss') : '--',
    style: {
      width: '20%',
    },
  },
]

onBeforeMount(() => {
  // 存在 activeTabId 参数，代表从项目列表跳转，需要清除 activeTabId
  if (route.query.activeTabId) {
    router.replace({ name: 'browser-list' })
  }
})

async function tableRequest(params: any) {
  return API.window.userGetTransferReceiveWindowListList(params)
}

async function howToGetHelp() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(TransferHelp, {
        onClose: () => {
          hideModal()
        },
        onConfirm: () => {
          hideModal()
        },
      })
    }
  })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable cache-key="browser-transfer-list" :columns="columns" :table-request="tableRequest" :show-gridlines="false" :show-actions="false" :show-table-header="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_transfer.svg" :title="$t('暂无转移窗口数据')">
        <template #extra>
          <div class="flex flex-col gap-3 help">
            <div>{{ $t('您可以直接将窗口转移到您拥有的其他工作空间。或者使用工作空间 ID 转移到他人的工作空间。') }}</div>
            <i18n-t tag="div" :keypath="$t('更多信息请查看：{link}。', { link: '{link}' })" scope="global">
              <template #link>
                <span class="cursor-pointer help-link" @click="howToGetHelp">{{ $t('空间 ID') }}</span>
              </template>
            </i18n-t>
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #profile="{ data }">
      <ProfileInfo :workspace-name="workspaceName" :data="data" readonly />
    </template>
    <template #note="{ data }">
      <RemarkIcon :value="data.windowRemark" disabled />
    </template>
    <template #transfer="{ data }">
      <div class="flex items-center">
        <RxAvatar v-bind="getWorkspaceAvatar(data)" />
        <div class="ml-3 space-name">{{ data.workspaceName }}</div>
        <div class="ml-1 space-id">ID: {{ data.workspaceNo }}</div>
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.space-name {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
}

.space-id {
  color: var(--colors-text-text-tertiary);
  font-family: "JetBrains Mono";
  font-size: 12px;
  line-height: 16px;
}

.help {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand);
  }
}
</style>
