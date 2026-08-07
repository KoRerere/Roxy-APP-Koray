<script setup lang="ts">
import type { AgentAccessMode } from '../composables/useAgentAccessMode'
import { useAgentAccessMode } from '../composables/useAgentAccessMode'
import AgentTooltip from './AgentTooltip.vue'

const emit = defineEmits<{
  select: [trigger: 'attach' | '@' | '/']
}>()

const { accessMode, fullAccess } = useAgentAccessMode()

const accessOptions: { value: AgentAccessMode, icon: string, title: string, label: string, desc: string }[] = [
  {
    value: 'ask',
    icon: 'roxy-agent/rx-ic-ask',
    title: $t('请求批准'),
    label: $t('请求批准'),
    desc: $t('执行不可逆操作前，均需获得您的确认'),
  },
  {
    value: 'full',
    icon: 'roxy-agent/rx-ic-allow',
    title: $t('完全访问权限'),
    label: $t('完全访问权限'),
    desc: $t('无需确认直接执行所有操作'),
  },
]

const currentAccessMode = computed<AgentAccessMode>(() => accessMode.value)
const currentAccessOption = computed(() => accessOptions.find(option => option.value === currentAccessMode.value) ?? accessOptions[0]!)

const approvalButtonClass = computed(() =>
  fullAccess.value
    ? 'approval-mode--full'
    : '',
)

function chooseAccess(mode: AgentAccessMode, close: () => void) {
  accessMode.value = mode
  close()
}

function handleSelect(trigger: 'attach' | '@' | '/') {
  emit('select', trigger)
}
</script>

<template>
  <div class="composer-toolbar">
    <AgentTooltip :content="$t('点击选择窗口，也可输入 “{at}” 选择', { at: '@' })" placement="top" :offset="8">
      <button data-composer-suggestion-trigger class="toolbar-action" type="button" aria-label="Select window" @click="handleSelect('@')">
        <SvgIcon class="toolbar-action__icon" name="roxy-agent/rx-ic-at" size="16" color="currentColor" />
        <span>{{ $t('选窗口') }}</span>
      </button>
    </AgentTooltip>

    <AgentTooltip :content="$t('点击选择任务模板，也可输入 “/” 选择')" placement="top" :offset="8">
      <button data-agent-select-template data-composer-suggestion-trigger class="toolbar-action" type="button" aria-label="Call skills" @click="handleSelect('/')">
        <SvgIcon class="toolbar-action__icon" name="roxy-agent/rx-ic-slash" size="16" color="currentColor" />
        <span>{{ $t('选模板') }}</span>
      </button>
    </AgentTooltip>

    <AgentTooltip :content="$t('点击上传文件，也可直接拖拽上传')" placement="top" :offset="8">
      <button class="toolbar-action" type="button" aria-label="Attach file" @click="handleSelect('attach')">
        <SvgIcon class="toolbar-action__icon" name="roxy-agent/rx-ic-attachment" size="16" color="currentColor" />
        <span>{{ $t('传文件') }}</span>
      </button>
    </AgentTooltip>

    <AgentTooltip
      trigger="click"
      placement="top-start"
      :offset="12"
      :show-arrow="false"
      content-class="approval-popover"
    >
      <button
        class="approval-mode"
        type="button"
        :class="approvalButtonClass"
        :aria-label="currentAccessOption.label"
      >
        <SvgIcon class="toolbar-action__icon" :name="currentAccessOption.icon" size="16" color="currentColor" />
        <span class="approval-mode__label">{{ currentAccessOption.label }}</span>
      </button>

      <template #content="{ close }">
        <div class="approval-popover__header">
          {{ $t('选择 Agent 的操作权限：批准后执行，或无需确认直接执行。') }}
        </div>

        <div class="approval-popover__body">
          <button
            v-for="option in accessOptions"
            :key="option.value"
            type="button"
            class="approval-option"
            :class="{ 'approval-option--selected': option.value === currentAccessMode }"
            @click="chooseAccess(option.value, close)"
          >
            <div class="approval-option__main">
              <SvgIcon :name="option.icon" size="18" color="currentColor" class="approval-option__icon" />
              <div class="approval-option__text">
                <span class="approval-option__title">{{ option.title }}</span>
                <span class="approval-option__desc">{{ option.desc }}</span>
              </div>
            </div>

            <SvgIcon
              v-if="option.value === currentAccessMode"
              name="base/rx_ic_check"
              size="16"
              color="currentColor"
            />
          </button>
        </div>
      </template>
    </AgentTooltip>
  </div>
</template>

<style lang="scss" scoped>
.composer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.toolbar-action {
  flex: none;
  gap: 4px;
  padding: 0 10px 0 8px;
  border: 1px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }
}

.toolbar-action__icon {
  width: 16px;
  height: 16px;
}

.approval-mode {
  flex: none;
  padding: 0 8px;
  border: 1px solid var(--color-border-secondary);
  color: var(--color-text-disabled);
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-secondary-hover);
    color: var(--color-text-primary);

    .approval-mode__label {
      max-width: 120px;
      margin-left: 4px;
      opacity: 1;
    }
  }
}

.approval-mode__label {
  max-width: 0;
  overflow: hidden;
  margin-left: 0;
  opacity: 0;
  transition:
    max-width 0.2s ease,
    margin-left 0.2s ease,
    opacity 0.15s ease;
}

:global(.agent-tooltip__content.approval-popover) {
  display: flex;
  width: min(480px, calc(100vw - 24px));
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  font-size: 14px;
  line-height: 20px;
  white-space: normal;
  box-shadow:
    0px 1px 1px 0px rgba(0, 0, 0, 0.04),
    0px 2px 8px 0px rgba(0, 0, 0, 0.04),
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12);
}

:global(.approval-popover__header) {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-quaternary);
  font-size: 14px;
  line-height: 20px;
  white-space: normal;
  overflow-wrap: anywhere;
}

:global(.approval-popover__body) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
}

:global(button.approval-option) {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  color: var(--color-text-primary);
  background: transparent;
  text-align: left;
}

:global(.approval-option:hover),
:global(.approval-option--selected) {
  background: var(--color-bg-quaternary);
}

:global(.approval-option__main) {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

:global(.approval-option__icon) {
  flex: none;
}

:global(.approval-option__text) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

:global(.approval-option__title) {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.approval-option__desc) {
  overflow: hidden;
  color: var(--color-text-quaternary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
