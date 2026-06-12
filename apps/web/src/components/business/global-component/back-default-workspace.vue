<script setup lang="ts">
import { useWorkspaceStore } from '/@/stores/workspace'
import RxAvatar from '/@/components/rx-avatar'
import { getWorkspaceAvatarProps } from '/@/utils/workspace'

const emit = defineEmits(['close'])

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { setCurrentWorkspace } = useWorkspaceStore()

const workspaceAvatarProps = computed(() => getWorkspaceAvatarProps({
  workspacePicture: currentWorkspace.value?.workspacePicture,
  workspaceName: currentWorkspace.value?.workspaceName,
  size: 32,
  emojiFontSize: 22,
  textFontSize: 18,
}))

function backDefaultWorkspace() {
  emit('close')
  setCurrentWorkspace(-1)
}
</script>

<template>
  <div class="flex flex-col pa-6 gap-12">
    <div class="title">
      {{ $t('空间被冻结') }}
    </div>
    <div class="flex flex-col items-center gap-3">
      <div class="pa-1 rounded-2 box">
        <RxAvatar v-bind="workspaceAvatarProps" />
      </div>
      <div class="name">
        {{ currentWorkspace!.workspaceName }}
      </div>
      <div class="whitespace-pre-wrap desc">
        {{ $t('很抱歉，当前工作空间已被冻结，请联系空间拥有者。\n如有疑问请通过右下角联系产品技术支持。') }}
      </div>
      <RxButton class="mt-1 w-full" variant="outlined" severity="secondary" icon="base/rx_ic_arrow_left" size="lg" :label="$t('回到默认空间')" @click="backDefaultWorkspace" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-family: Archivo;
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.box {
  border: 1px solid var(--colors-border-border-container);
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}

.name {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: normal;
}
</style>
