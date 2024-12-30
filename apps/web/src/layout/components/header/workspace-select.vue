<script setup lang="tsx">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api/'
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap, Role } from '/@/enums/'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import WorkspaceForm from '/@/views/workspace-setting/workspace-form.vue'

const roleLabelMap = getRoleLabelMap()
const workspaceStore = useWorkspaceStore()
const { currentWorkspace, workspaceList } = storeToRefs(workspaceStore)
const [workspaceFormDialog] = useDialog()
const toast = useToast()

const workspaceFormRef = ref<InstanceType<typeof WorkspaceForm>>()
const workspaceForm = ref({
  workspaceName: '',
  workspacePicture: '',
  maxWindowCount: 0,
})

function showCreateWorkspaceDialog() {
  return workspaceFormDialog.showModal({
    header: $t('创建新的工作空间'),
    class: 'w-[500px]',
    slots: {
      default: () => <WorkspaceForm ref={workspaceFormRef} v-model:workspaceInfo={workspaceForm.value} />,
    },
    async handleOk() {
      workspaceFormRef.value?.onInput()
      if (workspaceFormRef.value?.errorMessage) {
        return Promise.reject(new Error('表单校验失败'))
      }

      const { code, data, msg } = await API.limit.userAddWorkspaceInfoCreate(workspaceForm.value)
      if (code === 0) {
        console.log(data)
        workspaceStore.getWorkspaceList()
        workspaceForm.value.workspaceName = ''
        workspaceForm.value.workspacePicture = ''
        workspaceForm.value.maxWindowCount = 0
      }
      else {
        console.log(msg)
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
        return Promise.reject(new Error(msg))
      }
    },
  })
}

function getAvatarStyle(workspacePicture: string) {
  return workspacePicture ? {} : { backgroundColor: '#000', color: '#fff', fontSize: '14px' }
}
</script>

<template>
  <div v-if="currentWorkspace" class="workspace">
    <Select v-model="currentWorkspace" :options="workspaceList" option-label="name" class="workspace-select"
      :overlay-class="$style['workspace-select-overlay']">
      <template #value="slotProps">
        <Avatar :label="slotProps.value.workspacePicture || slotProps.value.workspaceName.slice(0, 2)"
          class="!w-[26px] !h-[26px]" :style="getAvatarStyle(slotProps.value.workspacePicture)" />
        <span class="workspace-name">{{ slotProps.value.workspaceName }}</span>
      </template>
      <template #option="slotProps">
        <Avatar :label="slotProps.option.workspacePicture || slotProps.option.workspaceName.slice(0, 2)"
          class="!w-[26px] !h-[26px]" :style="getAvatarStyle(slotProps.option.workspacePicture)" />

        <div>{{ slotProps.option.workspaceName }}</div>
        <span v-if="slotProps.option.role !== Role.OWNER" class="role-tag">
          <RxSvgIcon name="base/rx_ic_internet" :size="12" />
          {{ roleLabelMap[slotProps.option.role] }}
        </span>
      </template>
      <template #footer>
        <div class="select-footer" @click="showCreateWorkspaceDialog">
          <RxSvgIcon name="base/rx_ic_plus" />
          <span>{{ $t('创建新的工作空间') }}</span>
        </div>
      </template>
    </Select>
  </div>
</template>

<style lang="scss" module>
.workspace-select-overlay {
  :global(.p-select-list) {
    border-bottom: 1px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  :global(.p-select-option) {
    display: flex;
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 10px;
    align-items: center;
    gap: var(--spacing-md, 6px);
    align-self: stretch;
    border-radius: var(--radius-sm, 4px);
    background: var(--Colors-Background-bg-body, #fff);
  }
}
</style>

<style lang="scss" scoped>
.workspace {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);

  .workspace-select {
    width: unset;
    border: none;
    background-color: transparent;
    box-shadow: none;

    :deep(.p-select-list-container) {
      border-bottom: 1px solid var(--Colors-Border-border-container, #c7cdd1);
    }

    :deep(.p-select-label) {
      display: flex;
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
      align-items: center;
      gap: var(--spacing-md, 6px);
      padding-right: 0;
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 133.333% */

      img {
        display: flex;
        width: 20px;
        height: 20px;
        flex-direction: column;
        justify-content: center;
        flex-shrink: 0;
      }

      .workspace-name {
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
        /* 133.333% */
      }
    }
  }
}

.select-footer {
  cursor: pointer;
  display: flex;
  padding: 10px var(--spacing-md, 6px) 10px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  background: var(--Colors-Background-bg-body, #fff);

  span {
    flex: 1 0 0;
    color: #000;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 123.077% */
  }
}

.role-tag {
  display: flex;
  padding: var(--spacing-xs, 2px) var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-xs, 2px);
  border-radius: 25px;
  color: var(--Color-yellow-400, #db8d1a);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 14px;
  /* 140% */
}
</style>
