<script setup lang="tsx">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import InputText from 'primevue/inputtext'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { RxSvgIcon } from '/@/components/rx-icon'
import RyButton from '/@/components/ry-button'
import { useWorkspaceStore } from '/@/stores/workspace'

const styles = useCssModule()
const dialog = useDialog()
const toast = useToast()

const workspaceStore = useWorkspaceStore()
const { currentWorkspace } = storeToRefs(workspaceStore)
const moreActionPopoverRef = useTemplateRef('moreActionPopover')
const workspaceInfo = ref({
  icon: '🚀',
  name: 'Workspace name',
})

function showMoreActions(event: MouseEvent) {
  moreActionPopoverRef.value?.toggle(event)
}

function handleDeleteConfirm() {
  dialog.open(() => {
    const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')!

    async function confirmDelete() {
      const { code, data, msg } = await API.limit.userDelWorkspaceInfoCreate({ workspaceId: currentWorkspace.value?.id })
      if (code === 0) {
        workspaceStore.getWorkspaceList()
        dialogRef.value.close()
        toast.add({ severity: 'success', summary: 'Success', detail: 'Workspace deleted successfully' })
      }
      else {
        toast.add({ severity: 'error', summary: 'Error', detail: msg })
      }
    }

    return (
      <div class={styles['delete-confirm']}>
        <div class={styles['delete-confirm-title']}>
          Are you sure to delete the Workspace?
        </div>
        <div class={styles['delete-confirm-content']}>
          This action can’t be undo, please type this workspace’s name below, then click the delete button.
        </div>
        <InputText class="w-full" placeholder="Workspace name" />
        <div class="w-full flex justify-end gap-2">
          <RyButton outlined label="Cancel" onClick={() => dialogRef.value.close()} />
          <RyButton severity="danger" label="Delete Workspace" onClick={confirmDelete} />
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
</script>

<template>
  <div class="workspace-settings">
    <div class="content">
      <div class="row">
        <div>
          <div class="title">
            Workspace icon
          </div>
          <div class="description">
            Default icon show first 2 letters of your workspace’s name.
          </div>
        </div>
        <RxEmojiPicker v-model="workspaceInfo.icon" class="logo-wrap">
          <div class="logo">
            {{ workspaceInfo.icon }}
          </div>
          <div>Choose icon</div>
        </RxEmojiPicker>
      </div>

      <div class="row">
        <div>
          <div class="title">
            Workspace name
          </div>
          <div class="description">
            First 3 letters of your workspace name will be the prefix of all profiles’ ID
          </div>
        </div>
        <IconField>
          <InputText v-model="workspaceInfo.name" />
          <InputIcon>
            18/30
          </InputIcon>
          <div class="description">
            Profile ID: IAM-001, IAM-002
          </div>
        </IconField>
      </div>
    </div>

    <div class="footer">
      <RyButton type="button" severity="secondary" @click="showMoreActions">
        <RxSvgIcon name="base/rx_ic_more-h" />
        More
      </RyButton>
      <Button type="button" label="Save changes" />
    </div>
  </div>

  <Popover ref="moreActionPopover" :class="$style['more-action-popover']">
    <div class="action-list">
      <div class="action-item danger" @click="handleDeleteConfirm">
        <RxSvgIcon name="base/rx_ic_bin_1" />
        Delete workspace
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
  padding: 24px;

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

    .logo-wrap {
      display: flex;
      padding: var(--spacing-sm, 4px);
      align-items: center;
      gap: 10px;
      border-radius: var(--radius-lg, 8px);
      border: 1px solid var(--Colors-Border-border-container, #c7cdd1);

      /* shadow-sm */
      box-shadow:
        0px 4px 4px -1px rgba(0, 0, 0, 0.02),
        0px 1px 1px 0px rgba(0, 0, 0, 0.06);

      .logo {
        display: flex;
        width: 48px;
        height: 48px;
        justify-content: center;
        align-items: center;
        border-radius: var(--radius-sm, 4px);
        background: var(--Color-neutrals-100, #f0f3f5);
        border-radius: var(--radius-sm, 4px);
        background: var(--Color-neutrals-100, #f0f3f5);
        color: var(--Colors-Text-text-subtle, #c7cdd1);
        text-align: center;
        font-family: 'JetBrains Mono';
        font-size: 40px;
        font-style: normal;
        font-weight: 700;
        line-height: 28px; /* 70% */
      }
    }
  }
}

.footer {
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
