<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import RxAvatar from "/@/components/rx-avatar";
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import { API } from '/@/api';
;
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from "/@/hooks/useResponseToast";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";
import { emitter } from '/@/utils/eventBus';

const { windowTransferNo } = defineProps<{
  windowTransferNo: string
}>()

const emit = defineEmits(['close'])

const router = useRouter()
const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()
const { isOwner } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())

const workspaceName = computed(() => currentWorkspace.value?.workspaceName!.slice(0, 3).toLocaleUpperCase()!)

const transferTotal = ref(0)
const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '0%',
      minWidth: '180px',
    }
  },
  {
    title: $t('窗口名称'),
    key: 'windowName',
    style: {
      width: '10%',
      minWidth: '200px',
    }
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
      width: '30%',
    },
  },
  {
    title: $t('来自'),
    key: 'from',
    slot: 'from',
    style: {
      width: '20%',
    },
  },
]

async function tableRequest(params: any) {
  const result = await API.window.userGetTransferReceiveWindowListList({
    ...params,
    windowTransferNo
  })
  transferTotal.value = result.data.total
  return result
}

function getWorkspaceProps(item: Record<string, any>) {
  return {
    name: item.workspacePicture || item.workspaceName?.slice(0, 2),
    color: item.workspacePicture ? 'var(--pattern-topnav-space-emoji-bg)' : 'var(--pattern-topnav-space-avatar-bg)',
    size: 24,
    fontSize: item.workspacePicture ? 12 : 14,
    radius: '6px',
  }
}

async function onReceive() {
  const { code, msg } = await API.window.userAgreeTransferWindowCreate({
    total: transferTotal.value,
    windowTransferNo
  })
  handleBusinessCode(code, () => {
    showToast(code, msg)
    if (code !== 0) return
    toProject()
  })
  emit('close')
}

async function onReject() {
  const { code, msg } = await API.window.userRejectTransferWindowCreate({ windowTransferNo })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  emit('close')
}

async function toProject() {
  if (!isOwner.value) return
  //接收完窗口后跳转到项目列表
  const { data: { rows } } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
  const projectItem = rows.find(item => !!item.isTransfer)
  if (projectItem) {
    router.push({ name: 'project-item', params: { id: projectItem.project_id }, query: { title: projectItem.projectName } })
    emitter.emit('updateProjectList')
  }
}

</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('接收转移') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <RxAlert class="w-full" type="warn" :closable="false" :content="$t('注意：使用他人的窗口可能存在潜在风险，请确保来源可靠。')"></RxAlert>
    <div class="h-120">
      <RyTable :columns="columns" :table-request="tableRequest" :show-actions="false" :show-table-header="false">
        <template #profile="{ data }">
          <ProfileInfo :show-sort="false" :workspace-name="workspaceName" :data="data" readonly />
        </template>
        <template #note="{ data }">
          <RemarkIcon :value="data.windowRemark" disabled />
        </template>
        <template #transfer="{ data }">
          <div class="flex items-center">
            <RxAvatar v-bind="getWorkspaceProps(data)"></RxAvatar>
            <div class="ml-3 space-name">{{ data.workspaceName }}</div>
          </div>
        </template>
        <template #from="{ data }">
          <div class="flex items-center gap-2">
            <RxAvatar :avatar="data.operatorUserAvatar" :name="data.operatorUserName?.slice(0, 2)" :color="data.operatorUserAvatarColor" :size="24" :font-size="14"></RxAvatar>
            <span class="space-name">{{ data.operatorUserName }}</span>
          </div>
        </template>
      </RyTable>
    </div>
    <div class="flex justify-end gap-2">
      <RxButton severity="secondary" size="sm" outlined :label="$t('拒绝')" @click="onReject" />
      <RxButton severity="primary" size="sm" :label="$t('接收')" @click="onReceive" />
    </div>
  </div>
</template>


<style lang="scss" scoped>
.popup {
  width: 960px;
}

.header {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.space-name {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
}
</style>
