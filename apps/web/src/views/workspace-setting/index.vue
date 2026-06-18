<script setup lang="tsx">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import RxButton from '/@/components/rx-button'
import WorkspaceForm from './workspace-form.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { useDialog as useCustomDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { copyText, showPageLoading } from '/@/utils'
import { Role } from '/@/enums/role'
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'

const props = defineProps<{
  workspaceInfo: UnwrapRowType<UserGetWorkspaceListListData>
}>()

const emit = defineEmits<{
  delete: [{ isCurrentWorkspace: boolean, id: number }]
  save: []
  leave: [{ isCurrentWorkspace: boolean }]
}>()

const styles = useCssModule()
const dialog = useDialog()
const toast = useToast()
const confirm = useConfirm()
const userStore = useUserStore()
const { getWorkspaceList, currentWorkspace } = useWorkspaceStore()
const [showModal] = useCustomDialog()

const moreActionPopoverRef = useTemplateRef('moreActionPopover')

const errorMessage = ref('')
const workspaceInfo = ref({ ...props.workspaceInfo })

const workspaceOwner = computed(() => workspaceInfo.value.role === Role.OWNER)

function showMoreActions(event: MouseEvent) {
  moreActionPopoverRef.value?.toggle(event)
}

function copyWorkspaceName() {
  copyText(workspaceInfo.value.workspaceName!)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}

function handleDeleteConfirm() {
  const workspaceName = ref('')
  dialog.open(() => {
    const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')!

    async function confirmDelete() {
      const workspaceId = workspaceInfo.value.id!
      // 先删除本地团队的浏览器数据
      await globalThis.electronAPI.send('util:removeWorkspace', workspaceId)
      const { code, data, msg } = await API.limit.userDelWorkspaceInfoCreate({
        workspaceName: workspaceName.value,
        workspaceId,
      })
      if (code === 0) {
        const isCurrentWorkspace = workspaceInfo.value.id === currentWorkspace?.id
        if (!isCurrentWorkspace) {
          getWorkspaceList()
          userStore.fetchUserInfo()
        }
        dialogRef.value.close()
        // toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('删除团队成功'), life: 3000 })
        emit('delete', { isCurrentWorkspace, id: data })
      }
      else {
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
      }
    }

    return (
      <div class={styles['delete-confirm']}>
        <div class={styles['delete-confirm-title']}>
          <I18nT keypath={$t('您确认要删除 {workspaceName} 团队吗？', { workspaceName: '{workspaceName}' })}>
            {{ workspaceName: () => <b class="mx-1 cursor-pointer" onClick={copyWorkspaceName}>{workspaceInfo.value.workspaceName}</b> }}
          </I18nT>
        </div>
        <div class={styles['delete-confirm-content']}>
          <I18nT keypath={$t('该操作不可逆，删除后将会清空所有该团队的相关内容（窗口/项目/平台账号/代理 IP/团队成员/ API 等）{br}要确认删除，请在下方输入团队名称', { br: '{br}' })}>
            {{ br: () => <br /> }}
          </I18nT>
        </div>
        <TsFormInputText v-model={workspaceName.value} class="w-full" size="md" placeholder={$t('请确认要删除的团队名称')} />
        <div class="w-full flex justify-end gap-2">
          <RxButton outlined label={$t('取消')} onClick={() => dialogRef.value.close()} />
          <RxButton severity="danger" label={$t('删除团队')} disabled={workspaceName.value !== workspaceInfo.value.workspaceName} onClick={confirmDelete} />
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

  const { code, msg } = await API.limit.userMdfWorkspaceInfoCreate(workspaceInfo.value as any)
  if (code === 0) {
    getWorkspaceList()
    toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('团队信息更新成功'), life: 3000 })
    emit('save')
  }
  else if (code === 409) {
    showModal({
      header: $t('各团队可创建总量大于账号本身的限额'),
      class: 'w-[380px]',
      okText: $t('好的'),
      slots: {
        default: () => (
          <div class={styles.description}>
            <div>{$t('您在其他团队的可创建窗口数加上当前设置的窗口数，已超过账号本身的可创建窗口的最大值。')}</div>
            <div>{$t('当前操作无法继续，请调整后再保存。')}</div>
          </div>
        ),
      },
    })
  }
  else {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
  }
}

function leaveWorkspace() {
  confirm.require({
    group: 'deleteConfirmDialog',
    header: $t('离开团队'),
    message: $t('您确认要离开该团队吗？离开后将无法查看该团队内的任何内容'),
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
      const isCurrentWorkspace = workspaceInfo.value.id === currentWorkspace?.id
      const { code, msg } = await API.limit.userLeaveWorkspaceList({ workspaceId: workspaceInfo.value.id })
      if (code === 0) {
        // toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('您已成功离开团队'), life: 3000 })
        if (isCurrentWorkspace) {
          showPageLoading()
        }
        await getWorkspaceList()
        emit('leave', { isCurrentWorkspace })
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
      <template v-if="workspaceOwner && !workspaceInfo?.workspaceDefault">
        <RxButton outlined severity="secondary" icon="base/rx_ic_more-h" :label="$t('更多操作')" @click="showMoreActions" />
      </template>
      <div class="flex justify-end" :class="{ 'w-full': !(workspaceOwner && !workspaceInfo?.workspaceDefault) }">
        <RxButton v-if="workspaceOwner" :label="$t('保存修改')" @click="handleSaveChange" />
        <RxButton v-else :label="$t('离开团队')" severity="danger" @click="leaveWorkspace" />
      </div>
    </div>
  </div>

  <Popover ref="moreActionPopover" :class="$style['more-action-popover']">
    <div class="action-list">
      <div class="action-item danger" @click="handleDeleteConfirm">
        <SvgIcon name="base/rx_ic_bin_1" />
        {{ $t('删除团队') }}
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
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
  user-select: none;
}

.delete-confirm-content {
  color: var(--colors-text-text-tertiary, #8a9093);
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
  height: 100%;
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
  padding: var(--spacing-2xl, 16px) var(--spacing-none, 0px) 0 var(--spacing-none, 0px);
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
  background: var(--colors-background-bg-app, #fff);
  cursor: pointer;

  &.danger {
    color: var(--primitives-red-500, #f53838);
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
