<script setup lang="ts">
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { z } from 'zod'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { useWorkspaceStore } from '/@/stores/workspace'
import { emitter } from '/@/utils/eventBus'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/'
import { Role } from '/@/enums/role'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

const workspaceInfo = defineModel<UnwrapRowType<UserGetWorkspaceListListData>>('workspaceInfo', { required: true })
const errorMessage = defineModel<string>('errorMessage', { required: false, default: '' })

const workspaceStore = useWorkspaceStore()
const [showToast] = useResponseToast()

const exampleName = computed(() => {
  const _name = getWorkspaceNamePrefix(workspaceInfo.value.workspaceName)
  return Array.from({ length: 2 }, (_, i) => `${_name}-${`${i + 1}`.padStart(3, '0')}`).join(', ')
})

const disabled = computed(() => workspaceInfo.value.role !== Role.OWNER && Boolean(workspaceInfo.value.id))

/** 剩余可创建窗口数量 */
const remainWorkspaceCount = computed(() => {
  if (workspaceInfo.value?.id) {
    return workspaceStore.maxCreateWindowCount + workspaceStore.currentWorkspace?.maxWindowCount! - workspaceInfo.value.maxWindowCount!
  }
  return workspaceStore.maxCreateWindowCount - workspaceInfo.value.maxWindowCount!
})

function onInput() {
  const result = z.string()
    .min(1, $t('请输入团队名称'))
    .min(4, $t('团队名称最少 4 个字符'))
    .max(20, $t('团队名称最多 20 个字符'))
    .safeParse(workspaceInfo.value.workspaceName)

  if (result.error) {
    errorMessage.value = result.error.errors[0].message
  }
  else {
    errorMessage.value = ''
  }
}

watch(() => workspaceInfo.value.maxWindowCount, (val) => {
  if (workspaceInfo.value?.id) {
    emitter.emit('maxWindowCountChange', remainWorkspaceCount.value)
  }
})

onBeforeUnmount(() => {
  if (workspaceInfo.value?.id) {
    emitter.emit('maxWindowCountChange', undefined)
  }
})

function onCopy(text: any) {
  copyText(text)
  showToast(0, $t('复制成功'))
}

defineExpose({
  workspaceInfo,
  errorMessage,
  onInput,
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
      <div class="emoji-picker-box">
        <RxEmojiPicker v-model="workspaceInfo.workspacePicture" :disabled="disabled"
                       :fallback-text="workspaceInfo.workspaceName?.slice(0, 2)"
        />
        <div class="choose-icon-desc">
          {{ $t('选择图标') }}
        </div>
      </div>
    </div>

    <div class="row">
      <div>
        <div class="title">
          {{ $t('团队名称') }}
        </div>
        <div class="description">
          {{ $t('默认窗口信息会展示为团队名称的前三个字符与序号的组合') }}
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
          {{ $t('窗口信息示例：{name}', { name: exampleName }) }}
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

    .choose-icon-desc {
      color: var(--colors-text-text-tertiary, #575d60);
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 133.333% */
    }
  }
}
</style>
