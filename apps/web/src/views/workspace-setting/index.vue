<script setup lang="tsx">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { RxSvgIcon } from '/@/components/rx-icon'
import RyButton from '/@/components/ry-button'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'

const styles = useCssModule()
const dialog = useDialog()
const toast = useToast()
const confirm = useConfirm()

const workspaceStore = useWorkspaceStore()
const { isOwner } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(workspaceStore)
const moreActionPopoverRef = useTemplateRef('moreActionPopover')
const workspaceInfo = ref({
  id: currentWorkspace.value?.id,
  workspacePicture: currentWorkspace.value?.workspacePicture,
  workspaceName: currentWorkspace.value?.workspaceName,
})

watch(currentWorkspace, () => {
  workspaceInfo.value.id = currentWorkspace.value?.id
  workspaceInfo.value.workspacePicture = currentWorkspace.value?.workspacePicture
  workspaceInfo.value.workspaceName = currentWorkspace.value?.workspaceName
})

function showMoreActions(event: MouseEvent) {
  moreActionPopoverRef.value?.toggle(event)
}

function handleDeleteConfirm() {
  const workspaceName = ref('')
  dialog.open(() => {
    const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')!

    async function confirmDelete() {
      const workspaceId = currentWorkspace.value!.id!
      const { code, msg } = await API.limit.userDelWorkspaceInfoCreate({
        workspaceName: workspaceName.value,
        workspaceId,
      })
      if (code === 0) {
        workspaceStore.getWorkspaceList()
        dialogRef.value.close()
        toast.add({ severity: 'success', summary: 'Success', detail: $t('Workspace deleted successfully'), life: 3000 })
        electronAPI.send('util:removeWorkspace', workspaceId)
      }
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
      }
    }

    return (
      <div class={styles['delete-confirm']}>
        <div class={styles['delete-confirm-title']}>
          {$t('Are you sure to delete the Workspace?')}
        </div>
        <div class={styles['delete-confirm-content']}>
          {$t('This action can’t be undo, To confirm, type {workspaceName} in the box below.', {
            workspaceName: <b class="mx-1">{currentWorkspace.value?.workspaceName}</b>,
          })}
        </div>
        <InputText v-model={workspaceName.value} class="w-full" placeholder={$t('Workspace name')} />
        <div class="w-full flex justify-end gap-2">
          <RyButton outlined label={$t('Cancel')} onClick={() => dialogRef.value.close()} />
          <RyButton severity="danger" label={$t('Delete Workspace')} onClick={confirmDelete} />
        </div>
      </div>
    )
  }, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
  })
}

async function handleSaveChange() {
  const { code, data, msg } = await API.limit.userMdfWorkspaceInfoCreate(workspaceInfo.value)
  if (code === 0) {
    workspaceStore.getWorkspaceList()
    toast.add({ severity: 'success', summary: 'Success', detail: $t('Workspace updated successfully'), life: 3000 })
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
  }
}

function leaveWorkspace() {
  confirm.require({
    group: 'deleteConfirmDialog',
    class: 'w-[450px]',
    message: $t('This action can’t be undone, your related profiles can’t not be reach after leaving workspace.'),
    header: $t('Are you sure to leave the Workspace? '),
    acceptProps: {
      label: $t('Leave Workspace'),
    },
    accept: async () => {
      const { code, msg } = await API.limit.userLeaveWorkspaceList()
      if (code === 0) {
        workspaceStore.getWorkspaceList()
        toast.add({ severity: 'success', summary: 'Success', detail: 'You have left the workspace', life: 3000 })
      }
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
      }
    },
  })
}
</script>

<template>
  <div class="workspace-settings">
    <div class="content">
      <div class="row">
        <div>
          <div class="title">
            {{ $t('Workspace icon') }}
          </div>
          <div class="description">
            {{ $t('Default icon show first 2 letters of your workspace’s name. ') }}
          </div>
        </div>
        <div class="emoji-picker-box">
          <RxEmojiPicker v-model="workspaceInfo.workspacePicture" :disabled="!isOwner" :fallback-text="workspaceInfo.workspaceName?.slice(0, 2)" />
          <div class="choose-icon-desc">
            {{ $t('Choose icon') }}
          </div>
        </div>
      </div>

      <div class="row">
        <div>
          <div class="title">
            {{ $t('Workspace name') }}
          </div>
          <div class="description">
            {{ $t('First 3 letters of your workspace name will be the prefix of all profiles’ ID ') }}
          </div>
        </div>
        <div class="w-full">
          <IconField>
            <InputText v-model="workspaceInfo.workspaceName" :disabled="!isOwner" :invalid="!workspaceInfo.workspaceName?.length" maxlength="30" class="w-full" />
            <InputIcon class="input-limit-text">
              {{ workspaceInfo.workspaceName?.length }}/30
            </InputIcon>
          </IconField>
          <div class="description">
            Profile ID: IAM-001, IAM-002
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <template v-if="isOwner">
        <RyButton severity="secondary" @click="showMoreActions">
          <RxSvgIcon name="base/rx_ic_more-h" />
          {{ $t('More') }}
        </RyButton>
        <RyButton :label="$t('Save Changes')" @click="handleSaveChange" />
      </template>
      <div v-else class="w-full flex justify-end">
        <RyButton :label="$t('Leave workspace')" severity="danger" @click="leaveWorkspace" />
      </div>
    </div>
  </div>

  <Popover ref="moreActionPopover" :class="$style['more-action-popover']">
    <div class="action-list">
      <div class="action-item danger" @click="handleDeleteConfirm">
        <RxSvgIcon name="base/rx_ic_bin_1" />
        {{ $t('Delete Workspace') }}
      </div>
    </div>
  </Popover>
</template>

<style lang="scss" module>
.more-action-popover {
  :global(.p-popover-content) {
    padding: 0;
  }
}

.delete-confirm {
  display: flex;
  width: var(--width-xs, 384px);
  padding: 24px 24px 0 24px;

  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.delete-confirm-title {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px); /* 142.857% */
}

.delete-confirm-content {
  color: var(--Color-neutrals-600, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px); /* 150% */
}
</style>

<style lang="scss" scoped>
.workspace-settings {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 452px;
  margin: 0 auto;
  height: 100%;
}
.content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;

  .row {
    display: flex;
    padding: var(--spacing-2xl, 16px) 0px;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2xl, 16px);
    align-self: stretch;
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

    .title {
      align-self: stretch;
      color: #000;
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
    }
    .description {
      align-self: stretch;
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: Inter;
      font-size: 10px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px); /* 160% */
    }

    .choose-icon-desc {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
    }
  }
}

.input-limit-text {
  color: var(--Colors-Text-text-inactive, #a3a9ad);
  text-align: right;
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
}

.emoji-picker-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm, 4px);
}

.footer {
  width: 100%;
  display: flex;
  width: 452px;
  padding: var(--spacing-2xl, 16px) var(--spacing-none, 0px) var(--spacing-3xl, 20px) var(--spacing-none, 0px);
  justify-content: space-between;
  align-items: center;
}

.action-list {
  display: flex;
  padding: var(--spacing-sm, 4px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;
}
.action-item {
  display: flex;
  padding: 8px var(--spacing-md, 6px) 8px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  background: var(--Colors-Background-bg-body, #fff);
  cursor: pointer;

  &.danger {
    color: var(--Color-red-300, #f53838);
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px); /* 123.077% */
  }
}
</style>
