<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

interface AgentDeleteConfirmButtonProps {
  disabled?: boolean
  label?: string
}

interface AgentDeleteConfirmMessage {
  acceptLabel?: string
  acceptProps?: AgentDeleteConfirmButtonProps
  checkboxProps?: {
    label: string
    tooltip?: string
    value: boolean
  }
  class?: string
  header?: string
  message?: string
  rejectLabel?: string
  rejectProps?: AgentDeleteConfirmButtonProps
}

function getRejectLabel(message: AgentDeleteConfirmMessage) {
  return message.rejectLabel || message.rejectProps?.label || $t('取消')
}

function getAcceptLabel(message: AgentDeleteConfirmMessage) {
  return message.acceptLabel || message.acceptProps?.label || $t('确认')
}
</script>

<template>
  <ConfirmDialog
    group="agentConsoleDeleteConfirmDialog"
    :pt="{
      root: 'agent-console-delete-confirm-dialog-root',
    }"
  >
    <template #container="{ message, acceptCallback, rejectCallback }">
      <section class="agent-console-delete-confirm-dialog" :class="(message as AgentDeleteConfirmMessage).class">
        <div class="agent-console-delete-confirm-dialog__content">
          <div class="agent-console-delete-confirm-dialog__copy">
            <h2>{{ (message as AgentDeleteConfirmMessage).header }}</h2>
            <p>{{ (message as AgentDeleteConfirmMessage).message }}</p>
          </div>
        </div>

        <footer class="agent-console-delete-confirm-dialog__footer">
          <div v-if="(message as AgentDeleteConfirmMessage).checkboxProps" class="agent-console-delete-confirm-dialog__checkbox">
            <RxCheckbox
              v-model="(message as AgentDeleteConfirmMessage).checkboxProps!.value"
              :pt="{ root: 'items-center', box: '!w-4 !h-4' }"
              input-id="agent-console-delete-confirm-dialog-checkbox"
              binary
            />
            <label for="agent-console-delete-confirm-dialog-checkbox">
              {{ (message as AgentDeleteConfirmMessage).checkboxProps!.label }}
            </label>
            <RxSvgIcon
              v-if="(message as AgentDeleteConfirmMessage).checkboxProps!.tooltip"
              v-tooltip="{ value: (message as AgentDeleteConfirmMessage).checkboxProps!.tooltip, showDelay: 500, hideDelay: 300 }"
              name="base/rx_ic_info"
              :size="12"
            />
          </div>

          <div class="agent-console-delete-confirm-dialog__actions">
            <button
              class="agent-console-delete-confirm-dialog__button"
              type="button"
              :disabled="(message as AgentDeleteConfirmMessage).rejectProps?.disabled"
              @click="rejectCallback"
            >
              {{ getRejectLabel(message as AgentDeleteConfirmMessage) }}
            </button>
            <button
              class="agent-console-delete-confirm-dialog__button agent-console-delete-confirm-dialog__button--danger"
              type="button"
              :disabled="(message as AgentDeleteConfirmMessage).acceptProps?.disabled"
              @click="acceptCallback"
            >
              {{ getAcceptLabel(message as AgentDeleteConfirmMessage) }}
            </button>
          </div>
        </footer>
      </section>
    </template>
  </ConfirmDialog>
</template>

<style lang="scss" scoped>
:global(.agent-console-delete-confirm-dialog-root) {
  width: auto;
  max-width: none;
  padding: 0;
  border: 0 !important;
  border-radius: 16px;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible;
}

.agent-console-delete-confirm-dialog {
  box-sizing: border-box;
  display: flex;
  width: min(440px, calc(100vw - 32px));
  flex-direction: column;
  align-items: stretch;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: 0 16px 40px rgb(15 15 15 / 16%);
  overflow: hidden;
}

.agent-console-delete-confirm-dialog__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px;
  overflow: hidden;
}

.agent-console-delete-confirm-dialog__copy {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  p {
    width: 100%;
    color: var(--color-text-tertiary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
}

.agent-console-delete-confirm-dialog__footer {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
}

.agent-console-delete-confirm-dialog__checkbox {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 16px;

  label {
    cursor: pointer;
    user-select: none;
  }
}

.agent-console-delete-confirm-dialog__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-left: auto;
}

.agent-console-delete-confirm-dialog__button {
  display: inline-flex;
  height: 32px;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: var(--color-bg-secondary-hover);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.agent-console-delete-confirm-dialog__button--danger {
  color: var(--color-text-error-primary);
}

@media (max-width: 420px) {
  .agent-console-delete-confirm-dialog__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .agent-console-delete-confirm-dialog__actions {
    width: 100%;

    button {
      flex: 1;
    }
  }
}
</style>
