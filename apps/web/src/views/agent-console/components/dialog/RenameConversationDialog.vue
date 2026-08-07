<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import AgentInput from '../form/AgentInput.vue'
import './agent-dialog.scss'

interface RenameConversationDialogData {
  initialTitle: string
  onSave?: (title: string) => boolean | void | Promise<boolean | void>
}

interface AgentInputExpose {
  focus: () => void
}

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const dialogData = (dialogRef?.value.data ?? {}) as RenameConversationDialogData
const inputRef = useTemplateRef<AgentInputExpose>('inputRef')
const title = ref(dialogData.initialTitle ?? '')
const saving = ref(false)
const canSave = computed(() => Boolean(title.value.trim()) && !saving.value)

function closeDialog() {
  if (!saving.value)
    dialogRef?.value.close()
}

async function saveTitle() {
  const normalizedTitle = title.value.trim()
  if (!normalizedTitle || saving.value)
    return

  saving.value = true
  try {
    const shouldClose = await dialogData.onSave?.(normalizedTitle)
    if (shouldClose !== false)
      dialogRef?.value.close()
  }
  finally {
    saving.value = false
  }
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})
</script>

<template>
  <form class="agent-console-dialog__shell rename-conversation-dialog" @submit.prevent="saveTitle">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">{{ $t('重命名对话') }}</h2>
      <button
        class="rename-conversation-dialog__close"
        type="button"
        :aria-label="$t('关闭')"
        :disabled="saving"
        @click="closeDialog"
      >
        <SvgIcon name="roxy-agent/rx-ic-close" size="18" />
      </button>
    </header>

    <main class="agent-console-dialog__body rename-conversation-dialog__body">
      <AgentInput
        ref="inputRef"
        v-model="title"
        type="text"
        maxlength="200"
        :aria-label="$t('重命名对话')"
        :disabled="saving"
      />
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button" type="button" :disabled="saving" @click="closeDialog">
          {{ $t('取消') }}
        </button>
        <button class="agent-console-dialog__button dark" type="submit" :disabled="!canSave">
          {{ $t('保存') }}
        </button>
      </div>
    </footer>
  </form>
</template>

<style lang="scss" scoped>
:global(.agent-console-rename-conversation-dialog.p-dialog) {
  box-shadow: none;
}

.rename-conversation-dialog__body {
  flex: none;
  overflow: hidden;
}

.rename-conversation-dialog__close {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  padding: 0;
  place-items: center;
  border: 0;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}
</style>
