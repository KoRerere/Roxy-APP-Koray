<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import type { MyTemplateItem, MyTemplateKind } from '../my-templates'
import { isTemplateImageIconSource, pickTemplateThemeValue } from '../template-store'
import { useThemeStore } from '/@/stores/theme'
import AgentTooltip from '/@/views/agent-console/components/AgentTooltip.vue'
import AgentPopover from './AgentPopover.vue'
import AgentButton from './form/AgentButton.vue'

const props = defineProps<{
  item: MyTemplateItem
  unread?: boolean
  creatingTask?: boolean
  editDisabled?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  edit: [item: MyTemplateItem]
  delete: [item: MyTemplateItem]
  createTask: [item: MyTemplateItem]
  runInChat: [item: MyTemplateItem]
}>()

const themeStore = useThemeStore()
const actionMenuOpen = ref(false)

const kindPresentation = computed(() => ({
  script: {
    label: $t('脚本'),
    icon: 'roxy-agent/rx-ic-scripts',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
  },
  skill: {
    label: 'Skill',
    icon: 'roxy-agent/rx-ic-skills',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
  },
  prompt: {
    label: $t('提示词'),
    icon: 'roxy-agent/rx-ic-prompts',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
  },
}) satisfies Record<MyTemplateKind, {
  label: string
  icon: SvgNames
  background: string
  color: string
}>)

const templateIcon = computed(() => pickTemplateThemeValue(
  props.item.iconInfo?.icon,
  themeStore.realTheme === 'dark',
))
const templateImageIcon = computed(() => templateIcon.value && isTemplateImageIconSource(templateIcon.value) ? templateIcon.value : '')
const templateSvgIcon = computed(() => templateIcon.value && !isTemplateImageIconSource(templateIcon.value) ? templateIcon.value : '')
const templateSvgIconColor = computed(() => pickTemplateThemeValue(
  props.item.iconInfo?.primaryColor,
  themeStore.realTheme === 'dark',
) || 'var(--color-text-primary)')
function editTemplate() {
  if (props.editDisabled)
    return

  actionMenuOpen.value = false
  emit('edit', props.item)
}

function deleteTemplate() {
  actionMenuOpen.value = false
  emit('delete', props.item)
}

function createTask() {
  emit('createTask', props.item)
}

function runInChat() {
  emit('runInChat', props.item)
}
</script>

<template>
  <article class="my-template-card">
    <header class="my-template-card__header">
      <div
        class="my-template-card__identity"
        role="button"
        :tabindex="editDisabled ? -1 : 0"
        :aria-disabled="editDisabled"
        @click="editTemplate"
        @keydown.enter.prevent="editTemplate"
        @keydown.space.prevent="editTemplate"
      >
        <div class="my-template-card__avatar">
          <span v-if="unread" class="my-template-card__unread" aria-hidden="true" />
          <img v-if="templateImageIcon" :src="templateImageIcon" :alt="item.name">
          <SvgIcon
            v-else-if="templateSvgIcon"
            :name="(templateSvgIcon as any)"
            size="44"
            :color="templateSvgIconColor"
            aria-hidden="true"
          />
          <SvgIcon
            v-else
            :name="kindPresentation[item.kind].icon"
            size="32"
            color="var(--color-fg-tertiary)"
            aria-hidden="true"
          />
        </div>
        <div class="my-template-card__copy">
          <h2 :title="item.name">
            {{ item.name }}
          </h2>
          <p>
            <AgentTooltip
              :content="item.description"
              placement="top"
              :disabled="!item.description"
            >
              <span class="my-template-card__description-text">{{ item.description || $t('暂无描述') }}</span>
            </AgentTooltip>
          </p>
        </div>
      </div>

      <span
        class="my-template-card__kind"
        :style="{
          color: kindPresentation[item.kind].color,
          background: kindPresentation[item.kind].background,
        }"
      >
        <SvgIcon :name="kindPresentation[item.kind].icon" size="16" aria-hidden="true" />
        {{ kindPresentation[item.kind].label }}
      </span>
    </header>

    <div class="my-template-card__divider" />

    <footer class="my-template-card__actions">
      <AgentPopover
        v-model:open="actionMenuOpen"
        content-class="my-template-card-action-popover"
        placement="bottom-start"
        :offset="6"
        :z-index="90"
      >
        <button
          class="my-template-card__more-button"
          type="button"
          :aria-label="$t('更多操作')"
          :aria-expanded="actionMenuOpen"
        >
          <SvgIcon name="base/rx_ic_more-h" size="18" aria-hidden="true" />
        </button>

        <template #content>
          <button type="button" :disabled="editDisabled" @click="editTemplate">
            <SvgIcon name="base/rx_ic_agent_edit" size="16" aria-hidden="true" />
            <span>{{ $t('编辑') }}</span>
          </button>
          <button class="danger" type="button" :disabled="deleting" @click="deleteTemplate">
            <SvgIcon name="base/rx_ic_bin_1" size="16" aria-hidden="true" />
            <span>{{ $t('删除') }}</span>
          </button>
        </template>
      </AgentPopover>

      <div class="my-template-card__primary-actions">
        <AgentButton
          class="my-template-card__create-task"
          variant="secondary"
          :icon="false"
          :disabled="creatingTask"
          :aria-busy="creatingTask"
          @click="createTask"
        >
          {{ creatingTask ? $t('准备中...') : $t('创建任务') }}
        </AgentButton>
        <AgentButton
          class="my-template-card__run-in-chat"
          variant="secondary"
          :icon="false"
          @click="runInChat"
        >
          {{ $t('去对话运行') }}
        </AgentButton>
      </div>
    </footer>
  </article>
</template>

<style lang="scss" scoped>
.my-template-card {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.my-template-card__header {
  display: flex;
  width: 100%;
  height: 44px;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.my-template-card__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  border-radius: 8px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent);
    outline-offset: 2px;
  }

  &[aria-disabled='true'] {
    cursor: default;
  }
}

.my-template-card__avatar {
  position: relative;
  display: flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--color-bg-tertiary);

  img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
}

.my-template-card__unread {
  position: absolute;
  z-index: 1;
  top: -8px;
  right: -6px;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-bg-primary, #fcfcfc);
  border-radius: 50%;
  background: #f04438;
}

.my-template-card__copy {
  min-width: 0;
  flex: 1;

  :deep(.agent-tooltip__trigger) {
    display: flex;
    width: 100%;
    min-width: 0;
  }

  h2,
  p {
    width: 100%;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    // &:not(:disabled):hover {
    //   background: var(--color-bg-quaternary);
    // }
  }

  h2 {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  p {
    color: var(--color-text-quaternary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }
}

.my-template-card__description-text {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-template-card__kind {
  display: inline-flex;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.my-template-card__divider {
  width: 100%;
  height: 0;
  border-top: 1px dashed var(--color-border-secondary);
}

.my-template-card__actions {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.my-template-card__more-button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font: inherit;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent);
    outline-offset: 2px;
  }
}

.my-template-card__primary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.my-template-card__create-task {
  --agent-button-border: transparent;
}

// @media (hover: hover) {
//   .my-template-card:hover :deep(.my-template-card__run-in-chat) {
//     --agent-button-bg: var(--color-bg-primary-inverse);
//     --agent-button-bg-hover: var(--color-bg-primary-inverse-hover);
//     --agent-button-border: transparent;
//     --agent-button-color: var(--color-text-primary-inverse);
//   }
// }

.my-template-card__run-in-chat:hover {
  --agent-button-bg: var(--color-bg-primary-inverse);
  --agent-button-bg-hover: var(--color-bg-primary-inverse-hover);
  --agent-button-border: transparent;
  --agent-button-color: var(--color-text-primary-inverse);
}

:global(.my-template-card-action-popover) {
  display: flex;
  width: 132px;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  box-shadow: 0 12px 32px rgb(15 15 15 / 12%);
}

:global(.my-template-card-action-popover button) {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
}

:global(.my-template-card-action-popover button:hover) {
  background: var(--color-bg-quaternary);
}

:global(.my-template-card-action-popover button:disabled) {
  cursor: not-allowed;
  opacity: 0.45;
}

:global(.my-template-card-action-popover button.danger) {
  color: var(--color-text-error-primary, #f04438);
}

@media (max-width: 420px) {
  .my-template-card__actions {
    align-items: flex-start;
  }

  .my-template-card__primary-actions {
    flex: 1;
    gap: 6px;

    :deep(.agent-button) {
      flex: 1;
    }
  }
}
</style>
