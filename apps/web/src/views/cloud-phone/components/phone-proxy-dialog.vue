<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import RxButton from '/@/components/rx-button'
import RxSelectButton from '/@/components/rx-select-button'
import CustomPanel from '/@/views/browser/create/components/proxy-info/custom-panel.vue'
import ChoosePanel from '/@/views/browser/create/components/proxy-info/choose-panel.vue'
import NoproxyPanel from '/@/views/browser/create/components/proxy-info/noproxy-panel.vue'
import type { ProxyInfoItem } from '/@/views/browser/create/components/proxy-info/types'
import { useCloudPhones } from '../useCloudPhones'

const props = defineProps<{ phoneIds: string[] }>()
const emit = defineEmits<{ saved: [count: number] }>()
const visible = defineModel<boolean>('visible', { default: false })
const { t: $t } = useI18n()
const { batchChangeProxy } = useCloudPhones()
const mode = ref<'choose' | 'custom' | 'noproxy'>('choose')
const customProxy = ref<ProxyInfoItem | null>(null)
const chosenProxy = ref<ProxyInfoItem | null>(null)
const error = ref('')
const saving = ref(false)
const modeOptions = computed(() => [
  { label: $t('选择代理 IP'), value: 'choose' },
  { label: $t('添加代理 IP'), value: 'custom' },
  { label: $t('不使用'), value: 'noproxy' },
])

watch(visible, (value) => {
  if (value) {
    mode.value = 'choose'
    customProxy.value = null
    chosenProxy.value = null
    error.value = ''
  }
})
watch(mode, () => {
  error.value = ''
})

async function save() {
  if (saving.value) {
    return
  }
  error.value = ''
  // 等待共享代理表单写回最后一次输入。
  await nextTick()
  const proxy = mode.value === 'choose' ? chosenProxy.value : customProxy.value
  if (mode.value === 'choose' && (!proxy?.id || String(proxy.id) === '0')) {
    error.value = $t('请选择已有代理 IP')
    return
  }
  if (mode.value === 'custom' && (!proxy?.host?.trim() || !/^\d+$/.test(String(proxy.port ?? '')) || Number(proxy.port) < 1 || Number(proxy.port) > 65535)) {
    error.value = $t('请填写有效的代理 IP 主机和端口（1–65535）')
    return
  }
  saving.value = true
  try {
    const count = batchChangeProxy(props.phoneIds, mode.value === 'noproxy'
      ? { proxyMethod: 'noproxy', proxyCategory: 'noproxy', protocol: 'noproxy' }
      : { ...proxy, proxyMethod: mode.value })
    if (!count) {
      error.value = $t('所选云手机已不存在，请刷新列表后重试')
      return
    }
    emit('saved', count)
    visible.value = false
  }
  catch {
    error.value = $t('保存失败，请检查本地存储空间后重试')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :draggable="false" :header="$t('更换代理')" class="w-[min(720px,calc(100vw-32px))]" :closable="!saving" :close-on-escape="!saving">
    <div class="flex flex-col gap-4">
      <p class="m-0 text-3.5 tt-secondary">
        {{ $t('新的代理设置将应用于所选的 {count} 台云手机。', { count: phoneIds.length }) }}
      </p>
      <RxSelectButton v-model="mode" :options="modeOptions" option-label="label" option-value="value" data-key="value" size="lg" />
      <div class="rounded-2 bg-[var(--colors-background-bg-block)] p-4">
        <KeepAlive>
          <ChoosePanel v-if="mode === 'choose'" key="choose" v-model="chosenProxy" @create="mode = 'custom'" />
          <CustomPanel v-else-if="mode === 'custom'" key="custom" v-model="customProxy" />
          <NoproxyPanel v-else key="noproxy" />
        </KeepAlive>
      </div>
      <p v-if="error" role="alert" class="m-0 text-3.5 text-[var(--colors-text-text-error)]">
        {{ error }}
      </p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <RxButton outlined severity="secondary" :label="$t('取消')" :disabled="saving" @click="visible = false" />
        <RxButton :label="$t('保存')" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>
