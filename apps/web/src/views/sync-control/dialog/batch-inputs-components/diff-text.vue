<script setup lang="ts">
import type { UnwrapRowsType, UserGetWindowInfoV2ListData } from '@roxy/backend-api';
import { useWorkspaceStore } from '/@/stores/workspace';
import { RxSvgIcon } from '/@/components/rx-icon';

const props = defineProps({
  syncWindows: {
    type: Array as PropType<UnwrapRowsType<UserGetWindowInfoV2ListData>>,
    default: () => []
  }
})

const workspaceStore = useWorkspaceStore()
const textMap = ref<Recordable>({})

const workspaceName = computed(() => {
  return workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
})

watch(() => props.syncWindows, (val) => {
  val.forEach((window) => {
    textMap.value[window.dirId!] ||= ''
  })
}, { immediate: true })

defineExpose({
  get formData() {
    return props.syncWindows.reduce((acc, window) => {
      if (textMap.value[window.dirId!]) {
        acc[window.$pId] = textMap.value[window.dirId!]
      }
      return acc
    }, {})
  }
})
</script>

<template>
  <div class="diff-text">
    <template v-for="window in syncWindows" :key="window.dirId">
      <div class="form-item">
        <div class="form-item-label">
          <label for="diff-text">
            <span class="profile-name">{{ workspaceName }}-</span>
            <span class="profile-num">{{ window.windowSortNum }}</span>
          </label>
        </div>
        <div class="form-item-content">
          <Textarea v-model="textMap[window.dirId!]" class="textarea" rows="1" autoResize
            :placeholder="$t('请在此输入内容，支持换行')" />
        </div>
      </div>
    </template>
  </div>
</template>


<style lang="scss" scoped>
.diff-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4xl, 24px);
  overflow: auto;
  padding-right: 12px;

  .tips {
    color: var(--Colors-Text-text-tertiary, #7C8387);
    font-family: "PingFang SC";
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
  }
}

.form-item {
  display: flex;
  align-items: center;
  gap: 16px;

  .form-item-label {
    flex-shrink: 0;
    color: var(--Colors-Text-text-primary, #171c1f);

    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 32px;
  }

  .form-item-content {
    flex: auto;

    .textarea {
      width: 100%;
      color: var(--Component-Colors-TextInput-text-text-placeholder, #7C8387);
      font-family: "PingFang SC";
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>
