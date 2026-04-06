<script setup lang="tsx">
import WorkspaceManagerDialog from './workspace-manager-dialog.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { WorkspaceType } from '/@/enums'

const [showModal] = useDialog()
const { isOwner } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { getWorkspaceList, setCurrentWorkspace } = useWorkspaceStore()

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

const showBack = computed(() => currentWorkspace.value?.workspaceType === WorkspaceType.Public && !isOwner.value)

async function showWorkspaceManager() {
  await getWorkspaceList()
  showModal({
    header: $t('工作空间管理'),
    pt: {
      title: '!text-[20px]',
    },
    class: '!w-[570px]',
    slots: {
      default: ({ hideModal }) => <WorkspaceManagerDialog hideFn={hideModal} />,
      footer: undefined,
    },
  })
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <div class="workspace-manager" @click="showWorkspaceManager">
      <RxAvatar v-bind="avatarProps" />
      <div class="text-3.5">
        {{ currentWorkspace?.workspaceName }}
      </div>
      <RxButton class="!shadow-none" size="xxs" severity="secondary" icon="base/rx_ic_exchange" :label="$t('切换空间')" />
    </div>
    <RxButton v-if="showBack" class="!shadow-none" size="xs" severity="secondary" icon="base/rx_ic_return" :label="$t('回到默认空间')" @click="setCurrentWorkspace(-1)" />
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
