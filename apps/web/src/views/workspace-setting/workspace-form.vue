<script setup lang="ts">
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { z } from 'zod'
import { RxEmojiPicker } from '/@/components/rx-emoji-picker'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { RxInputNumber } from '/@/components/rx-input-number'
import { useWorkspaceStore } from '/@/stores/workspace'
import { emitter } from '/@/utils/eventBus'

const { operationType = 'edit' } = defineProps<{ operationType?: 'create' | 'edit' }>()
const workspaceInfo = defineModel<UnwrapRowType<UserGetWorkspaceListListData>>('workspaceInfo', { required: true })
const errorMessage = defineModel<string>('errorMessage', { required: false, default: '' })

const workspaceStore = useWorkspaceStore()
const { isOwner } = storeToRefs(useRoleStore())

const exampleName = computed(() => {
  const _name = workspaceInfo.value.workspaceName?.slice(0, 3).toLocaleUpperCase()
  return Array.from({ length: 2 }, (_, i) => `${_name}-${`${i + 1}`.padStart(3, '0')}`).join(', ')
})

const maxCreateWindowCount = computed(() => {
  return workspaceStore.getMaxCreateWindowCount(operationType === 'create' ? 0 : workspaceInfo.value.id)
})

function onInput() {
  const result = z.string()
    .min(1, $t('请输入空间名称'))
    .regex(/^[^\u4E00-\u9FA5]+$/, $t('空间名称不能包含中文'))
    .min(4, $t('空间名称最少 4 个字符'))
    .max(30, $t('空间名称最多 30 个字符'))
    .safeParse(workspaceInfo.value.workspaceName)

  if (result.error) {
    errorMessage.value = result.error.errors[0].message
  }
  else {
    errorMessage.value = ''
  }
}

watch(() => workspaceInfo.value.maxWindowCount, (val) => {
  emitter.emit('maxWindowCountChange', maxCreateWindowCount.value - val)
})

onBeforeUnmount(() => {
  emitter.emit('maxWindowCountChange', workspaceStore.defaultWorkspace?.maxWindowCount - workspaceStore.defaultWorkspace?.useWindowCount)
})

defineExpose({
  workspaceInfo,
  errorMessage,
  onInput,
})
</script>

<template>
  <div class="content">
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
        <RxEmojiPicker v-model="workspaceInfo.workspacePicture" :disabled="!isOwner"
          :fallback-text="workspaceInfo.workspaceName?.slice(0, 2)" />
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
          <InputText v-model="workspaceInfo.workspaceName" :disabled="!isOwner" :invalid="!!errorMessage" maxlength="30"
            class="w-full" @input="onInput" />
          <InputIcon class="input-limit-text">
            {{ workspaceInfo.workspaceName?.length }}/30
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
    <div v-if="isOwner" class="row">
      <div class="w-full flex justify-between items-center">
        <div>
          <div class="title">{{ $t('窗口创建限制') }}</div>
          <div class="description">
            <i18n-t :keypath="$t('当前空间可以创建窗口的数量（剩余可分配用量：{count}个）', { count: '{count}' })" scope="global">
              <template #count>
                {{ maxCreateWindowCount - workspaceInfo.maxWindowCount }}
              </template>
            </i18n-t>
          </div>
        </div>
        <RxInputNumber v-model="workspaceInfo.maxWindowCount" :min="0" :max="maxCreateWindowCount" :disabled="!isOwner"
          class="!w-120px" />
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
