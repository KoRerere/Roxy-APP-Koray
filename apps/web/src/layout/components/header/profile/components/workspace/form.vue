<script setup lang="ts">
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { z } from 'zod'
import WorkspaceIconPicker from '/@/layout/components/header/profile/components/workspace/icon-picker.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getFirstZodIssueMessage } from '/@/utils/zod-error'
import { copyText } from '/@/utils/'
import { Role } from '/@/enums/role'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

const workspaceInfo = defineModel<UnwrapRowType<UserGetWorkspaceListListData>>('workspaceInfo', { required: true })
const errorMessage = defineModel<string>('errorMessage', { required: false, default: '' })

const iconPickerRef = useTemplateRef<{
  commitWorkspaceImage: (workspaceId: number) => Promise<string | undefined>
}>('iconPicker')
const [showToast] = useResponseToast()
const profileLabels = useProfileEntityLabels()

const exampleName = computed(() => {
  const _name = getWorkspaceNamePrefix(workspaceInfo.value.workspaceName)
  return Array.from({ length: 2 }, (_, i) => `${_name}-${`${i + 1}`.padStart(3, '0')}`).join(', ')
})

const disabled = computed(() => workspaceInfo.value.role !== Role.OWNER && Boolean(workspaceInfo.value.id))

function onInput() {
  const result = z.string()
    .min(1, $t('请输入团队名称'))
    .min(4, $t('团队名称最少 4 个字符'))
    .max(20, $t('团队名称最多 20 个字符'))
    .safeParse(workspaceInfo.value.workspaceName)

  if (!result.success) {
    errorMessage.value = getFirstZodIssueMessage(result.error)
  }
  else {
    errorMessage.value = ''
  }
}

function onCopy(text: any) {
  copyText(text)
  showToast(0, $t('复制成功'))
}

/** 有新选图才上传；创建时传入新空间 ID，编辑时用当前表单 ID */
async function commitWorkspaceImage(workspaceId?: number) {
  const targetWorkspaceId = workspaceId ?? workspaceInfo.value.id
  if (!targetWorkspaceId) {
    return
  }
  return iconPickerRef.value?.commitWorkspaceImage(targetWorkspaceId)
}

defineExpose({
  workspaceInfo,
  errorMessage,
  onInput,
  commitWorkspaceImage,
})
</script>

<template>
  <div class="content">
    <div v-if="workspaceInfo.workspaceNo" class="row">
      <div class="flex items-center gap-3">
        <div class="title">
          {{ $t('团队 ID') }}:
        </div>
        <div class="flex items-center !mt-0 gap-2 description">
          <span>{{ workspaceInfo.workspaceNo }}</span>
          <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" @click="onCopy(workspaceInfo.workspaceNo!)" />
        </div>
      </div>
    </div>
    <div class="row">
      <div>
        <div class="title">
          {{ $t('团队图标') }}
        </div>
        <div class="description">
          {{ $t('默认图标展示团队名称的前两个字符') }}
        </div>
      </div>
      <WorkspaceIconPicker
        ref="iconPicker"
        v-model:picture="workspaceInfo.workspacePicture"
        v-model:picture-url="workspaceInfo.workspacePictureUrl"
        :disabled="disabled"
        :fallback-text="workspaceInfo.workspaceName?.slice(0, 2)"
      />
    </div>

    <div class="row">
      <div>
        <div class="title">
          {{ $t('团队名称') }}
        </div>
        <div class="description">
          {{ profileLabels.defaultEntityInfoExample }}
        </div>
      </div>
      <div class="w-full">
        <IconField>
          <InputText v-model="workspaceInfo.workspaceName" :disabled="disabled" :invalid="!!errorMessage"
                     :maxlength="20" class="w-full" @input="onInput"
          />
          <InputIcon class="input-limit-text">
            {{ workspaceInfo.workspaceName?.length }}/20
          </InputIcon>
        </IconField>
        <div v-if="errorMessage" class="description !text-red">
          {{ errorMessage }}
        </div>
        <div class="description">
          {{ profileLabels.entityInfoExample(exampleName) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
    border-bottom: 0.5px solid var(--component-dropdown-divider, #c7cdd1);

    &:last-child {
      border-bottom: none;
    }

    .title {
      align-self: stretch;
      color: var(--colors-text-text-primary, #fafafa);
      font-family: Inter;
      font-size: 14px;
      font-weight: 500;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 133.333% */
    }

    .description {
      margin-top: var(--spacing-xs, 4px);
      align-self: stretch;
      color: var(--colors-text-text-tertiary, #575d60);
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 160% */
    }
  }
}
</style>
