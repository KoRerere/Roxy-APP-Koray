<script setup lang="ts">
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { z } from 'zod'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { Role } from '/@/enums'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { emitter } from '/@/utils/eventBus'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/'

const workspaceInfo = defineModel<UnwrapRowType<UserGetWorkspaceListListData>>('workspaceInfo', { required: true })
const errorMessage = defineModel<string>('errorMessage', { required: false, default: '' })

const workspaceStore = useWorkspaceStore()
const [showToast] = useResponseToast()

const exampleName = computed(() => {
  const _name = workspaceInfo.value.workspaceName?.slice(0, 3).toLocaleUpperCase()
  return Array.from({ length: 2 }, (_, i) => `${_name}-${`${i + 1}`.padStart(3, '0')}`).join(', ')
})

const isOwner = computed(() => workspaceInfo.value.role === Role.OWNER)

const disabled = computed(() => !isOwner.value && Boolean(workspaceInfo.value.id))

/** 剩余可创建窗口数量 */
const remainWorkspaceCount = computed(() => {
  if (workspaceInfo.value?.id) {
    return workspaceStore.maxCreateWindowCount + workspaceStore.currentWorkspace?.maxWindowCount! - workspaceInfo.value.maxWindowCount!
  }
  return workspaceStore.maxCreateWindowCount - workspaceInfo.value.maxWindowCount!
})

function onInput() {
  const result = z.string()
    .min(1, $t('请输入空间名称'))
    .regex(/^[^\u4E00-\u9FA5]+$/, $t('空间名称不能包含中文'))
    .min(4, $t('空间名称最少 4 个字符'))
    .max(20, $t('空间名称最多 20 个字符'))
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
    <div class="row" v-if="workspaceInfo.workspaceNo">
      <div class="flex items-center gap-3">
        <div class="title">{{ $t('空间ID') }}:</div>
        <div class="flex items-center !mt-0 gap-2 description">
          <span>{{ workspaceInfo.workspaceNo }}</span>
          <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" @click="onCopy(workspaceInfo.workspaceNo!)"></SvgIcon>
        </div>
      </div>
    </div>
    <div class="row">
      <div>
        <div class="title">
          {{ $t('空间图标') }}
        </div>
        <div class="description">
          {{ $t('默认图标展示工作空间名称的前两个字符') }}
        </div>
      </div>
      <div class="emoji-picker-box">
        <RxEmojiPicker v-model="workspaceInfo.workspacePicture" :disabled="disabled" :fallback-text="workspaceInfo.workspaceName?.slice(0, 2)" />
        <div class="choose-icon-desc">
          {{ $t('选择图标') }}
        </div>
      </div>
    </div>

    <div class="row">
      <div>
        <div class="title">
          {{ $t('空间名称') }}
        </div>
        <div class="description">
          {{ $t('默认窗口信息会展示为空间名称的前三个字符与序号的组合') }}
        </div>
      </div>
      <div class="w-full">
        <IconField>
          <InputText v-model="workspaceInfo.workspaceName" :disabled="disabled" :invalid="!!errorMessage" :maxlength="20" class="w-full" @input="onInput" />
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
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

    .title {
      align-self: stretch;
      color: #000;
      font-family: Inter;
      font-size: 14px;
      font-weight: 500;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 133.333% */
    }

    .description {
      margin-top: var(--spacing-xs, 4px);
      align-self: stretch;
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 160% */
    }

    .choose-icon-desc {
      color: var(--Colors-Text-text-tertiary, #7c8387);
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
