<script setup lang="tsx">
import RxAvatar from "/@/components/rx-avatar";
import { RxSvgIcon } from '/@/components/rx-icon';
import { useDialog } from '/@/hooks/useDialog';
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace';
import WorkspaceManagerDialog from './workspace-manager-dialog.vue';

const [showModal] = useDialog()
const workspaceStore = useWorkspaceStore()
const { currentWorkspace } = storeToRefs(workspaceStore)

const avatarProps = computed(() => {
  const { workspacePicture, workspaceName } = currentWorkspace.value || {}
  return {
    name: workspacePicture || workspaceName?.slice(0, 2),
    color: workspacePicture ? 'var(--pattern-topnav-space-emoji-bg)' : 'var(--pattern-topnav-space-avatar-bg)',
    size: 26,
    fontSize: workspacePicture ? 16 : 14,
    radius: '6px',
  }
})

async function showWorkspaceManager() {
  await workspaceStore.getWorkspaceList()
  showModal({
    header: $t('工作空间管理'),
    pt: {
      title: '!text-[20px]'
    },
    class: '!w-[570px]',
    slots: {
      default: ({ hideModal }) => <WorkspaceManagerDialog hideFn={hideModal} />,
      footer: undefined
    }
  })
}
</script>

<template>
  <div class="workspace-manager" @click="showWorkspaceManager">
    <RxAvatar v-bind="avatarProps" />
    <div class="text-3.5">{{ currentWorkspace?.workspaceName }}</div>
    <RxSvgIcon name="base/rx_ic_chevron_right" :size="12" />
  </div>
</template>

<style lang="scss" scoped>
.workspace-manager {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
</style>
