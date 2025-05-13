<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
import { API } from '/@/api';
import { $t } from '/@/locales';

const props = defineProps<{
  value: any
  bindType: 'Google' | 'Github' | 'Facebook' | 'VK'
}>()

const emit = defineEmits(['bind', 'unbind'])

const confirm = useConfirm();

async function handleClick(event: Event) {
  if (props.value) {
    // 绑定类型: Google/Github/Facebook/VK
    confirm.require({
      target: event.currentTarget as HTMLElement,
      group: 'popup',
      message: $t('确定要解绑该第三方账号吗？'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true
      },
      acceptProps: {
        label: $t('确定'),
        severity: 'danger'
      },
      accept: async () => {
        await API.base.userUnbindEmailCreate({
          bind_type: props.bindType,
        })
        emit('unbind')
      },
    });

  } else {
    emit('bind')
  }
}
</script>

<template>
  <div class="w-full flex gap-2 items-center justify-between">
    <div v-tooltip.top="value" class="truncate w-[152px]" :class="{ 'not-linked': !value }">
      {{ value || 'Not linked' }}
    </div>
    <RxButton severity="secondary" outlined :label="value ? $t('解绑') : $t('绑定')" @click="handleClick" />
  </div>
</template>

<style scoped lang="scss">
.not-linked {
  color: var(--colors-text-text-inactive, #7D8387);
}
</style>
