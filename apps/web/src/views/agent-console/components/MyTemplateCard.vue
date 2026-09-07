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
  topping?: boolean
}>()

const emit = defineEmits<{
  edit: [item: MyTemplateItem]
  delete: [item: MyTemplateItem]
  createTask: [item: MyTemplateItem]
  runInChat: [item: MyTemplateItem]
  toggleTop: [item: MyTemplateItem]
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

function readMetadataTags(metadata: Record<string, unknown>): string[] {
  const nestedMetadata = metadata.skillMetadata
  const source = metadata.labels
    ?? metadata.tags
    ?? (nestedMetadata && typeof nestedMetadata === 'object' && !Array.isArray(nestedMetadata)
      ? (nestedMetadata as Record<string, unknown>).tags
      : undefined)

  if (!Array.isArray(source)) {
    return []
  }

  return source
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim()
      }
      if (tag && typeof tag === 'object' && !Array.isArray(tag)) {
        const record = tag as Record<string, unknown>
        const value = record.label ?? record.name ?? record.slug
        return typeof value === 'string' ? value.trim() : ''
      }
      return ''
    })
    .filter((tag, index, tags): tag is string => Boolean(tag) && tags.indexOf(tag) === index)
}

const versionText = computed(() => {
  const version = props.item.metadata.version
  const normalizedVersion = typeof version === 'string'
    ? version.trim().replace(/^v/i, '')
    : typeof version === 'number' && Number.isFinite(version)
      ? String(version)
      : ''
  return `v${normalizedVersion || '1.0.0'}`
})

const templateTags = computed(() => {
  const kindLabel = kindPresentation.value[props.item.kind].label
  return [kindLabel, ...readMetadataTags(props.item.metadata)]
    .filter((tag, index, tags) => tags.indexOf(tag) === index)
    .slice(0, 3)
})

function editTemplate() {
  if (props.editDisabled) {
    return
  }

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

function toggleTop() {
  if (props.topping) {
    return
  }

  actionMenuOpen.value = false
  emit('toggleTop', props.item)
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
          <p>{{ versionText }}</p>
        </div>
      </div>
    </header>

    <div class="my-template-card__divider" />

    <div class="my-template-card__tags">
      <span
        v-for="tag in templateTags"
        :key="tag"
        class="my-template-card__tag"
      >
        {{ tag }}
      </span>
    </div>

    <AgentTooltip
      :content="item.description || $t('暂无描述')"
      placement="top-start"
      :disabled="!item.description"
      trigger-class="my-template-card__description-trigger"
    >
      <p class="my-template-card__description">
        {{ item.description || $t('暂无描述') }}
      </p>
    </AgentTooltip>

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
          <button type="button" :disabled="topping" @click="toggleTop">
            <SvgIcon
              :name="item.isTopped ? 'base/rx_ic_pin_solid' : 'base/rx_ic_pin_line'"
              size="16"
              aria-hidden="true"
            />
            <span>{{ item.isTopped ? $t('取消置顶') : $t('置顶') }}</span>
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
  height: 212px;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-tertiary);
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
  background: var(--color-bg-quaternary);

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
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;

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
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }
}

.my-template-card__tags {
  display: flex;
  width: 100%;
  height: 24px;
  min-width: 0;
  flex: 0 0 24px;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.my-template-card__tag {
  display: inline-flex;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-quaternary);
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

.my-template-card__description {
  display: -webkit-box;
  width: 100%;
  height: 40px;
  flex: 0 0 40px;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-quaternary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

:deep(.my-template-card__description-trigger) {
  display: flex;
  width: 100%;
  height: 40px;
  flex: 0 0 40px;
  flex-direction: column;
  min-width: 0;
  outline: 0;
}

.my-template-card__actions {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.my-template-card__more-button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  padding: 7px;
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
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  :deep(.agent-button) {
    height: 32px;
    flex: 1;
    padding-top: 5px;
    padding-bottom: 5px;
  }
}

.my-template-card__run-in-chat {
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
    gap: 6px;
  }
}
</style>
