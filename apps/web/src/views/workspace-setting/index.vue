<script setup lang="tsx">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import WorkspaceForm from './workspace-form.vue'

const router = useRouter()
const styles = useCssModule()
const dialog = useDialog()
const toast = useToast()
const confirm = useConfirm()

const workspaceStore = useWorkspaceStore()
const { isOwner } = storeToRefs(useRoleStore())
const { currentWorkspace } = storeToRefs(workspaceStore)
const moreActionPopoverRef = useTemplateRef('moreActionPopover')

const errorMessage = ref('')
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
      // 先删除本地空间的浏览器数据
      await electronAPI.send('util:removeWorkspace', workspaceId)
      const { code, msg } = await API.limit.userDelWorkspaceInfoCreate({
        workspaceName: workspaceName.value,
        workspaceId,
      })
      if (code === 0) {
        workspaceStore.getWorkspaceList()
        dialogRef.value.close()
        toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('删除工作空间成功'), life: 3000 })
      }
      else {
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
      }
    }

    return (
      <div class={styles['delete-confirm']}>
        <div class={styles['delete-confirm-title']}>
          <I18nT keypath={$t('您确认要删除 {workspaceName} 工作空间吗？', { workspaceName: '{workspaceName}' })}>
            {{ workspaceName: () => <b class="mx-1">{currentWorkspace.value?.workspaceName}</b> }}
          </I18nT>
        </div>
        <div class={styles['delete-confirm-content']}>
          <I18nT keypath={$t('该操作不可逆，删除后将会清空所有该空间的相关内容（窗口/项目/平台账号/代理/团队成员/ API 等）{br}要确认删除，请在下方输入空间名称', { br: '{br}' })}>
            {{ br: () => <br /> }}
          </I18nT>
        </div>
        <InputText v-model={workspaceName.value} class="w-full" placeholder={$t('请确认要删除的空间名称')} />
        <div class="w-full flex justify-end gap-2">
          <RxButton outlined label={$t('取消')} onClick={() => dialogRef.value.close()} />
          <RxButton severity="danger" label={$t('删除空间')} disabled={workspaceName.value !== currentWorkspace.value?.workspaceName} onClick={confirmDelete} />
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
  if (errorMessage.value)
    return

  const { code, data, msg } = await API.limit.userMdfWorkspaceInfoCreate(workspaceInfo.value)
  if (code === 0) {
    workspaceStore.getWorkspaceList()
    toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('工作空间信息更新成功'), life: 3000 })
  }
  else {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
  }
}

function leaveWorkspace() {
  confirm.require({
    group: 'deleteConfirmDialog',
    header: $t('离开空间'),
    message: $t('您确认要离开该空间吗？离开后将无法查看该空间内的任何内容'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const { code, msg } = await API.limit.userLeaveWorkspaceList()
      if (code === 0) {
        toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('您已成功离开工作空间'), life: 3000 })
        await workspaceStore.getWorkspaceList()
        router.push({ name: 'browser' })
      }
      else {
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
      }
    },
  })
}
</script>

<template>
  <div class="workspace-settings">
    <WorkspaceForm v-model:workspace-info="workspaceInfo" v-model:error-message="errorMessage" />

    <div class="footer">
      <template v-if="isOwner && !currentWorkspace?.workspaceDefault">
        <RxButton outlined severity="secondary" icon="base/rx_ic_more-h" :label="$t('更多操作')" @click="showMoreActions" />
      </template>
      <div class="flex justify-end" :class="{ 'w-full': !(isOwner && !currentWorkspace?.workspaceDefault) }">
        <RxButton v-if="isOwner" :label="$t('保存修改')" @click="handleSaveChange" />
        <RxButton v-else :label="$t('离开空间')" severity="danger" @click="leaveWorkspace" />
      </div>
    </div>
  </div>

  <Popover ref="moreActionPopover" :class="$style['more-action-popover']">
    <div class="action-list">
      <div class="action-item danger" @click="handleDeleteConfirm">
        <RxSvgIcon name="base/rx_ic_bin_1" />
        {{ $t('删除空间') }}
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
  line-height: var(--Line-Height-text-lg, 20px);
  /* 142.857% */
}

.delete-confirm-content {
  color: var(--Color-neutrals-600, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);
  /* 150% */
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
    line-height: var(--Line-Height-text-xs, 16px);
    /* 123.077% */
  }
}
</style>
