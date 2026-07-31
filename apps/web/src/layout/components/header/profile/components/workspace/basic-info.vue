<script setup lang="ts">
import WorkspaceSetting from '/@/layout/components/header/profile/components/workspace/setting.vue'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useDialog } from '/@/hooks/useDialog'
import { getRoleLabelMap } from '/@/enums/role'
import { getWorkspaceAvatarProps } from '/@/utils/workspace'

import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

const { userPayInfo } = storeToRefs(useUserStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { setCurrentWorkspace } = useWorkspaceStore()

const [showModal] = useDialog()
const profileLabels = useProfileEntityLabels()

const roleStr = getRoleLabelMap()

const avatarProps = computed(() => {
  const { workspacePicture, workspaceName } = currentWorkspace.value || {}
  return getWorkspaceAvatarProps({
    workspacePicture,
    workspaceName,
    size: 32,
    emojiFontSize: 22,
    textFontSize: 18,
  })
})

function editWorkspace() {
  showModal({
    header: $t('编辑团队'),
    class: 'w-130',
    slots: {
      footer: undefined,
      default: ({ handleCancel }) => {
        function handleLeaveWorkspace({ isCurrentWorkspace, id }: { isCurrentWorkspace: boolean, id?: number }) {
          // 如果离开/删除的是当前空间，则需要进入其他空间
          handleCancel()
          if (isCurrentWorkspace) {
            id && setCurrentWorkspace(id)
            globalThis.electronAPI.send('mcp:close')
          }
        }

        return h(WorkspaceSetting, {
          workspaceInfo: toRaw(currentWorkspace.value!),
          onSave: handleCancel,
          onDelete: handleLeaveWorkspace,
          onLeave: handleLeaveWorkspace,
        })
      },
    },
  })
}
</script>

<template>
  <div class="w-full flex items-center py-2 pl-2.5 pr-1.5 gap-1.5">
    <RxAvatar v-bind="avatarProps" />
    <div>
      <div class="tt-primary text-3.25 font-700 leading-4">
        {{ currentWorkspace!.workspaceName }}
      </div>
      <div class="flex items-center gap-0.75 tt-inactive text-3 leading-normal">
        <span>{{ roleStr[currentWorkspace?.role as keyof typeof roleStr] }}</span>
        <span>·</span>
        <span>{{ userPayInfo.maxWindowCount }}</span>
        <span>{{ profileLabels.entity }}</span>
        <span>·</span>
        <span>{{ currentWorkspace!.useMemberCount }}</span>
        <span>{{ $t('成员') }}</span>
      </div>
    </div>
    <RxButton class="mx-auto mr-0 shrink-0" icon="base/rx_ic_more-v" size="xxs" severity="secondary" variant="text" @click="editWorkspace" />
  </div>
</template>

<style scoped></style>
