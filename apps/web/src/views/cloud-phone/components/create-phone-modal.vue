<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useCloudPhones } from '../useCloudPhones'
import Dialog from 'primevue/dialog'

const emit = defineEmits<{
  (e: 'success'): void
}>()

const { t: $t } = useI18n()

const visible = defineModel<boolean>('visible', { default: false })
const { addPhone, groups } = useCloudPhones()

const form = ref({
  name: '',
  system: 'Android 15',
  group: '未分组',
  tagInput: '',
  tags: [] as string[],
  notes: '',
  proxyType: 'custom',
  proxyLocation: 'HK/HongKong',
  proxyIp: '103.14.90.094',
})

const systemOptions = [
  { label: 'Android 15 (Recommended)', value: 'Android 15' },
  { label: 'Android 14', value: 'Android 14' },
  { label: 'Android 13', value: 'Android 13' },
]

function addTag() {
  const val = form.value.tagInput.trim()
  if (val && !form.value.tags.includes(val)) {
    form.value.tags.push(val)
  }
  form.value.tagInput = ''
}

function removeTag(tag: string) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

function handleSubmit() {
  if (!form.value.name.trim()) {
    form.value.name = `Phone-${Date.now().toString().slice(-4)}`
  }
  addPhone({
    name: form.value.name,
    system: form.value.system,
    group: form.value.group,
    tags: form.value.tags,
    notes: form.value.notes,
    proxyLocation: form.value.proxyLocation,
    proxyIp: form.value.proxyIp,
  })
  visible.value = false
  emit('success')
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="$t('创建云手机')" :style="{ width: '560px' }" class="create-phone-dialog">
    <div class="flex flex-col gap-4 py-2">
      <!-- Phone Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-3 font-medium text-[var(--colors-text-text-primary)]">
          <span class="text-red-500">*</span> {{ $t('云手机名称') }}
        </label>
        <input
          v-model="form.name"
          type="text"
          :placeholder="$t('请输入云手机名称')"
          class="h-8.5 px-3 text-3 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD]"
        >
      </div>

      <!-- Operating System -->
      <div class="flex flex-col gap-1.5">
        <label class="text-3 font-medium text-[var(--colors-text-text-primary)]">
          {{ $t('系统版本') }}
        </label>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="sys in systemOptions"
            :key="sys.value"
            class="flex items-center justify-center py-2 px-2.5 rounded border cursor-pointer text-3 transition-all"
            :class="form.system === sys.value
              ? 'border-[#11A3FD] bg-[#EBF7FF] text-[#11A3FD] font-semibold dark:bg-[#082b45]'
              : 'border-[var(--colors-border-border-inactive)] text-[var(--colors-text-text-secondary)] hover:border-[#11A3FD]'"
            @click="form.system = sys.value"
          >
            {{ sys.value }}
          </div>
        </div>
      </div>

      <!-- Group & Tags -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-3 font-medium text-[var(--colors-text-text-primary)]">
            {{ $t('分组') }}
          </label>
          <select
            v-model="form.group"
            class="h-8.5 px-3 text-3 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD]"
          >
            <option value="未分组">
              {{ $t('未分组') }}
            </option>
            <option v-for="g in groups.filter(item => item !== 'all' && item !== '未分组')" :key="g" :value="g">
              {{ g }}
            </option>
            <option value="TikTok Matrix">
              TikTok Matrix
            </option>
            <option value="Social Matrix">
              Social Matrix
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-3 font-medium text-[var(--colors-text-text-primary)]">
            {{ $t('标签') }}
          </label>
          <div class="flex items-center gap-1.5">
            <input
              v-model="form.tagInput"
              type="text"
              :placeholder="$t('输入标签按回车')"
              class="flex-1 h-8.5 px-3 text-3 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD]"
              @keydown.enter.prevent="addTag"
            >
            <button
              type="button"
              class="px-2.5 h-8.5 text-3 rounded bg-[var(--colors-background-bg-secondary,#f1f5f8)] text-[var(--colors-text-text-secondary)] hover:text-[#11A3FD]"
              @click="addTag"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div v-if="form.tags.length" class="flex flex-wrap gap-1.5 -mt-2">
        <span
          v-for="t in form.tags"
          :key="t"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2.5 bg-[#EBF7FF] text-[#11A3FD] dark:bg-[#082b45]"
        >
          {{ t }}
          <span class="cursor-pointer font-bold" @click="removeTag(t)">×</span>
        </span>
      </div>

      <!-- Proxy Settings -->
      <div class="flex flex-col gap-1.5 p-3 rounded-lg border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-secondary,#fafbfc)]">
        <div class="flex items-center justify-between">
          <span class="text-3 font-semibold text-[var(--colors-text-text-primary)]">{{ $t('代理 IP 配置') }}</span>
          <span class="text-2.5 text-[#11A3FD]">{{ $t('支持 HTTP / SOCKS5') }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <input
            v-model="form.proxyLocation"
            type="text"
            placeholder="Location (e.g. HK/HongKong)"
            class="h-8 px-2.5 text-2.75 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD]"
          >
          <input
            v-model="form.proxyIp"
            type="text"
            placeholder="Proxy IP (e.g. 103.14.90.094)"
            class="h-8 px-2.5 text-2.75 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD]"
          >
        </div>
      </div>

      <!-- Notes -->
      <div class="flex flex-col gap-1.5">
        <label class="text-3 font-medium text-[var(--colors-text-text-primary)]">
          {{ $t('备注') }}
        </label>
        <textarea
          v-model="form.notes"
          rows="2"
          :placeholder="$t('请输入备注信息')"
          class="p-2.5 text-3 rounded border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-input,#fff)] text-[var(--colors-text-text-primary)] outline-none focus:border-[#11A3FD] resize-none"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--colors-border-divider)]">
        <button
          type="button"
          class="px-4 py-1.5 rounded text-3 text-[var(--colors-text-text-secondary)] hover:bg-[var(--colors-background-bg-secondary,#f1f5f8)]"
          @click="visible = false"
        >
          {{ $t('取消') }}
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded text-3 font-medium text-white bg-[#11A3FD] hover:bg-[#0282D4] shadow-sm"
          @click="handleSubmit"
        >
          {{ $t('创建') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.create-phone-dialog :deep(.p-dialog-header) {
  padding: 16px 20px 12px;
  border-bottom: 0.5px solid var(--colors-border-divider);
}
.create-phone-dialog :deep(.p-dialog-content) {
  padding: 12px 20px;
}
.create-phone-dialog :deep(.p-dialog-footer) {
  padding: 10px 20px 16px;
}
</style>
