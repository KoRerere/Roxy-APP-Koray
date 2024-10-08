<script setup lang="ts">
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import RyButton from '/@/components/ry-button'

defineProps<{
  workspaceInfo: UnwrapRowType<UserGetWorkspaceListListData>
}>()

defineEmits(['joinWorkspace', 'skip'])
</script>

<template>
  <div class="invite-into-workspace">
    <div class="detail-box">
      <div class="detail-body">
        <div class="workspace-icon">
          {{ workspaceInfo.workspacePicture }}
        </div>
        <div class="workspace-name">
          {{ workspaceInfo.workspaceName }}
        </div>
        <div class="detail-content">
          {{ $t('workspace.invitationTips', { workspaceName: workspaceInfo.workspaceName }) }}
        </div>
      </div>
      <RyButton class="w-full" @click="$emit('joinWorkspace')">
        {{ $t('workspace.joinWorkspace') }}
      </RyButton>
      <rx-divider />
      <RyButton class="w-full" outlined @click="$emit('skip')">
        {{ $t('common.Skip') }}
      </RyButton>
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
      font-size: 40px;
      font-style: normal;
      font-weight: 700;
      line-height: 28px; /* 70% */
    }

    .workspace-name {
      color: #000;
      text-align: center;
      font-family: Inter;
      font-size: 16px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-lg, 20px); /* 125% */
    }

    .detail-content {
      align-self: stretch;
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px); /* 142.857% */
    }
  }
}
</style>
