<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'

type InviteInfo = Record<'workspaceName' | 'workspacePicture' | 'endTime' | 'data', string>

const props = defineProps<{
  inviteInfo: InviteInfo
  onClose: () => void
}>()

const router = useRouter()
const toast = useToast()
const workspaceStore = useWorkspaceStore()
const { getWorkspaceList, setCurrentWorkspace } = workspaceStore


const isInWorkspace = computed(() => workspaceStore.workspaceList.some(item => item.id === props.inviteInfo?.workspaceId))

// window.electronAPI.on('invite:to-project', async (searchStr) => {
//   console.log('invite:to-project', searchStr)
//   // 替换加号为 %2B，避免 URLSearchParams 将加号（+）解释为空格
//   const queryString = searchStr.replace(/\+/g, '%2B')
//   const params = new URLSearchParams(queryString)
//   props.inviteInfo = Object.fromEntries(params) as InviteInfo

//   console.log('inviteInfo: ', props.inviteInfo)

//   if (props.inviteInfo.data) {
//     console.log('invite:to-project code', props.inviteInfo.data)
//     if (route.name !== 'login') {
//       visible.value = true
//     }
//   }
//   else {
//     console.error('invite:to-project code is null')
//   }
// })

/** 接受邀请 */
async function acceptInvitation() {
  if (!props.inviteInfo?.data) {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: $t('接受邀请失败'), life: 3000 })
    return
  }
  const { code, msg, data } = await API.limit.userAddUserByProjectInfoCreate(props.inviteInfo.data)

  if (code === 0) {
    toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('加入成功'), life: 3000 })
    await getWorkspaceList()
    setCurrentWorkspace(Number(data))
    skipInvitation()
    router.push({ name: 'browser' })
  }
  else {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
  }
}

/** 跳过邀请 */
function skipInvitation() {
  props.onClose()
}
</script>

<template>
  <div class="invite-into-workspace">
    <div class="detail-box">
      <div class="detail-body">
        <Avatar class="workspace-icon" :style="{ backgroundColor: inviteInfo?.workspacePicture ? '' : 'black' }"
          :label="inviteInfo?.workspacePicture || inviteInfo?.workspaceName?.slice(0, 2)" size="xlarge" />
        <div class="workspace-name">
          {{ inviteInfo?.workspaceName }}
        </div>
        <div class="detail-content">
          {{ $t('您被邀请至工作空间 {workspaceName}', { workspaceName: inviteInfo?.workspaceName }) }}
        </div>
      </div>
      <RxButton class="w-full capitalize" :disabled="isInWorkspace" @click="acceptInvitation">
        {{ isInWorkspace ? $t('已加入') : $t('加入工作空间') }}
      </RxButton>
      <rx-divider />
      <RxButton class="w-full" outlined @click="skipInvitation">
        {{ $t('忽略') }}
      </RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.invite-into-workspace {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;

  .detail-box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2xl, 16px);
    align-self: stretch;

    .detail-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
    }

    .workspace-icon {
      display: flex;
      width: 48px;
      height: 48px;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
      color: var(--Colors-Text-text-subtle, #c7cdd1);
      text-align: center;
      font-family: 'JetBrains Mono';
      font-size: 32px;
      font-style: normal;
      font-weight: 700;
      line-height: 28px;
      /* 70% */
    }

    .workspace-name {
      color: #000;
      text-align: center;
      font-family: Inter;
      font-size: 16px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 125% */
    }

    .detail-content {
      align-self: stretch;
      color: var(--colors-text-text-secondary, #b2b6b8);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 142.857% */
    }
  }
}
</style>
