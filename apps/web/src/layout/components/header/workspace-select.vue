<script setup lang="tsx">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api/'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { defineFormSchema } from '/@/components/rx-form'
import { RxSvgIcon } from '/@/components/rx-icon'
import { roleLabelMap } from '/@/enums/'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'

const workspaceStore = useWorkspaceStore()
const { currentWorkspace, workspaceList } = storeToRefs(workspaceStore)
const [dialog] = useFormDialog()
const toast = useToast()

const formSchemas = defineFormSchema([
  {
    field: 'workspaceName',
    component: 'InputText',
    label: 'Name',
    componentProps: {
      placeholder: $t('Please enter your workspace name'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, $t('Workspace name is required'))
          .min(2, $t('Workspace name must be at least 2 characters long'))
          .max(30, $t('Workspace name must be less than 30 characters'))
      },
    },
  },
  {
    field: 'workspacePicture',
    component: ({ formModel }) => <RxEmojiPicker v-model={formModel.workspacePicture} class="!w-[fit-content]" />,
    label: 'Icon',
  },
])

function showCreateWorkspaceDialog() {
  dialog.showModal({
    header: $t('Create new workspace'),
    class: 'w-[500px]',
    schemas: formSchemas,
    async handleOk(formModel) {
      const { code, data, msg } = await API.limit.userAddWorkspaceInfoCreate(formModel)
      if (code === 0) {
        console.log(data)
        workspaceStore.getWorkspaceList()
      }
      else {
        console.log(msg)
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
        return Promise.reject()
      }
    },
  })
}

onBeforeMount(() => {
  workspaceStore.getWorkspaceList()
})
</script>

<template>
  <div v-if="currentWorkspace" class="workspace">
    <Select v-model="currentWorkspace" :options="workspaceList" option-label="name"
            class="workspace-select" :overlay-class="$style['workspace-select-overlay']"
    >
      <template #value="slotProps">
        <Avatar :label="slotProps.value.workspacePicture || slotProps.value.workspaceName.at(0)" class="!w-[26px] !h-[26px]" />
        <span class="workspace-name">{{ slotProps.value.workspaceName }}</span>
      </template>
      <template #option="slotProps">
        <Avatar :label="slotProps.option.workspacePicture || slotProps.option.workspaceName.at(0)" class="!w-[26px] !h-[26px]" />

        <div>{{ slotProps.option.workspaceName }}</div>
        <span class="role-tag">
          <RxSvgIcon name="base/rx_ic_internet" size="10" />
          {{ roleLabelMap[slotProps.option.role] }}
        </span>
      </template>
      <template #footer>
        <div class="select-footer" @click="showCreateWorkspaceDialog">
          <RxSvgIcon name="base/rx_ic_plus" />
          <span>{{ $t('Create new workspace') }}</span>
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
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
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
  padding: 8px var(--spacing-md, 6px) 8px 10px;
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
  background: #ffeacc;
  color: var(--Color-yellow-400, #db8d1a);
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 500;
  line-height: 14px;
  /* 140% */
}
</style>
