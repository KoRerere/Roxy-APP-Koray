<script setup lang="tsx">
import { RxSvgIcon } from '/@/components/rx-icon';
import { useDialog } from '/@/hooks/useDialog';
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace';
import WorkspaceManagerDialog from './workspace-manager-dialog.vue';

const [showModal] = useDialog()
const workspaceStore = useWorkspaceStore()
const { currentWorkspace } = storeToRefs(workspaceStore)

const avatarStyle = computed(() => {
  return currentWorkspace.value?.workspacePicture ? {} : {
    backgroundColor: 'var(--pattern-topnav-space-avatar-bg)',
    color: '#fff',
    fontSize: '14px'
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
    <Avatar :label="currentWorkspace?.workspacePicture || currentWorkspace?.workspaceName?.slice(0, 2)"
      class="workspace-icon-small" :style="avatarStyle" />
    <div>{{ currentWorkspace?.workspaceName }}</div>
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

.workspace-icon-small {
  display: flex;
  align-items: center;
  width: 26px;
  height: 26px;
  text-transform: uppercase;
  color: #FFF;
  text-align: center;
  font-family: "JetBrains Mono";
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 14px;
  /* 153.846% */
  letter-spacing: -0.26px;
}
</style>
