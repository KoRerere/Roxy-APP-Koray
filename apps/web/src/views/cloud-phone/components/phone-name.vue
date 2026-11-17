<script setup lang="ts">
import { ref, watch } from 'vue'
import Inplace from 'primevue/inplace'
import InputText from 'primevue/inputtext'
import { $t } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useCloudPhones } from '../useCloudPhones'
import type { CloudPhoneItem } from '../useCloudPhones'

const { data } = defineProps<{ data: CloudPhoneItem }>()
const emit = defineEmits<{ refresh: [] }>()
const { renamePhone } = useCloudPhones()
const [showToast] = useResponseToast()
const name = ref(data.name)

watch(() => data.name, (value) => {
  name.value = value
})

function saveName(closeCallback: () => void) {
  const value = name.value.trim()
  try {
    if (value && value !== data.name) {
      renamePhone(data.id, value)
      emit('refresh')
    }
  }
  catch {
    showToast(-1, $t('保存失败，请检查本地存储空间后重试'))
  }
  name.value = data.name
  closeCallback()
}

function cancel(closeCallback: () => void) {
  name.value = data.name
  closeCallback()
}
</script>

<template>
  <Inplace
    v-focustrap
    class="phone-name-editor w-full min-w-0"
    @click.stop
  >
    <template #display>
      <div class="phone-name-display h-6.5 w-full min-w-0 cursor-text truncate rounded-1 border border-solid border-transparent px-2 py-1 leading-4" :title="data.name">
        {{ data.name }}
      </div>
    </template>
    <template #content="{ closeCallback }">
      <InputText v-model="name" autofocus size="small" class="h-6.5 w-full min-w-0 rounded-1 !px-2 !py-1 !text-3 !leading-4 !shadow-none" :maxlength="100" :aria-label="$t('云手机名称')" :placeholder="$t('请输入云手机名称')" @blur="saveName(closeCallback)" @keydown.enter.prevent="saveName(closeCallback)" @keydown.esc.prevent.stop="cancel(closeCallback)" />
    </template>
  </Inplace>
</template>

<style scoped>
.phone-name-editor {
  width: 100%;
}

.phone-name-editor :deep(.p-inplace-display),
.phone-name-editor :deep(.p-inplace-content) {
  display: flex;
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 0;
}

.phone-name-editor :deep(.p-inplace-display:focus-visible) {
  outline-color: transparent;
}

.phone-name-display:hover {
  border-color: var(--pattern-profiles-input-border);
  background: var(--pattern-profiles-input-bg);
}
</style>
