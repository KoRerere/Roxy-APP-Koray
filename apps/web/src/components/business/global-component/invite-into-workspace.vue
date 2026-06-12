<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'

import { useWorkspaceStore } from '/@/stores/workspace'
import RxAvatar from '/@/components/rx-avatar'
import { getWorkspaceAvatarProps } from '/@/utils/workspace'

type InviteInfo = Record<'workspaceName' | 'workspacePicture' | 'endTime' | 'data' | 'workspaceId', any>

const props = defineProps<{
  inviteInfo?: InviteInfo
  onClose?: (intoWorkspaceId?: number) => void | Promise<void>
}>()

const toast = useToast()
const workspaceStore = useWorkspaceStore()


const isInWorkspace = computed(() => workspaceStore.workspaceList.some(item => item.id === props.inviteInfo?.workspaceId))

const workspaceAvatarProps = computed(() => getWorkspaceAvatarProps({
  workspacePicture: props.inviteInfo?.workspacePicture,
  workspaceName: props.inviteInfo?.workspaceName,
  size: 48,
  emojiFontSize: 28,
  textFontSize: 28,
}))

/** 接受邀请 */
async function acceptInvitation() {
  if (!props.inviteInfo?.data) {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: $t('接受邀请失败'), life: 3000 })
    return
  }
  const { code, msg, data } = await API.limit.userAddUserByProjectInfoCreate(props.inviteInfo.data)

  if (code === 0) {
    await workspaceStore.fetchWorkspaceList()
    skipInvitation(data)
  }
  else {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
  }
}

/** 跳过邀请 */
async function skipInvitation(intoWorkspaceId?: number) {
  await props.onClose?.(intoWorkspaceId)
}
</script>

<template>
  <div class="invite-into-workspace">
    <div class="detail-box">
      <div class="pb-1 detail-body">
        <RxAvatar v-bind="workspaceAvatarProps" />
        <div class="workspace-name">
          {{ inviteInfo?.workspaceName }}
        </div>
        <div class="detail-content">
          {{ $t('您被邀请至工作空间 {workspaceName}', { workspaceName: inviteInfo?.workspaceName }) }}
        </div>
      </div>
      <RxButton class="w-full capitalize" size="lg" :disabled="isInWorkspace" :label="isInWorkspace ? $t('已加入') : $t('加入工作空间')" @click="acceptInvitation"></RxButton>
      <RxDivider />
      <RxButton class="w-full" size="lg" outlined :label="$t('忽略')" @click="skipInvitation()"></RxButton>
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
    gap: var(--spacing-2xl, 12px);
    align-self: stretch;

    .detail-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
    }

    .workspace-name {
      color: var(--colors-text-text-primary, #FAFAFA);
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
