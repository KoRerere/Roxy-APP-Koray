<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import RxAvatar from "/@/components/rx-avatar";
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import { API } from '/@/api';
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from "/@/hooks/useResponseToast";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";
import { useProjectStore } from '/@/stores/project'

const { windowTransferNo } = defineProps<{
  windowTransferNo: string
}>()

const emit = defineEmits(['close'])

const router = useRouter()
const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()
const { getProjects: getProjectList } = useProjectStore()
const workspaceStore = useWorkspaceStore()
const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName!.slice(0, 3).toLocaleUpperCase()!)

const transferTotal = ref(0)
const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '40%',
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
    title: $t('投送至'),
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
  //接收完窗口后跳转到项目列表
  const { data: { rows } } = await getProjectList()
  const projectItem = rows.find(item => !!item.isTransfer)
  if (projectItem) {
    router.push({ name: 'project-item', params: { id: projectItem.project_id }, query: { title: projectItem.projectName } })
  }
}

</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('接收投送') }}</span>
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
            <Avatar :label="data.workspacePicture || data.workspaceName?.slice(0, 2)" class="space-icon"
              :class="{ '!bg-black': !data.workspacePicture }"
              :pt="{ label: data.workspacePicture ? 'text-[12px]' : 'text-[14px]' }" />
            <div class="ml-3 space-name">{{ data.workspaceName }}</div>
          </div>
        </template>
        <template #from="{ data }">
          <div class="flex items-center gap-2">
            <RxAvatar :avatar="data.operatorUserAvatar" :name="data.operatorUserName?.slice(0, 2)"
              :color="data.operatorUserAvatarColor" :size="24" :font-size="14"></RxAvatar>
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

.space-icon {
  width: 24px;
  height: 24px;
  color: #fff;
  text-align: center;
  font-family: 'JetBrains Mono';
  font-size: 12px !important;
  font-style: normal;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: -0.4px;
  text-transform: uppercase;
}

.space-name {
  color: var(--component-button-primary-text, #111213);
  font-size: 14px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.space-id {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: "JetBrains Mono";
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
