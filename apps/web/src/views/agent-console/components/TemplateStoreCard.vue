<script setup lang="ts">
import type { TemplateKind, TemplateStoreItem } from '../template-store'
import AgentTooltip from './AgentTooltip.vue'
import { isTemplateImageIconSource, pickTemplateThemeValue } from '../template-store'
import { useThemeStore } from '/@/stores/theme'

const props = defineProps<{
  item: TemplateStoreItem
  installed?: boolean
  busyAction?: 'get' | 'run'
}>()

const emit = defineEmits<{
  get: [id: number]
  run: [id: number]
}>()

const themeStore = useThemeStore()

const kindLabel = computed(() => ({
  script: $t('脚本'),
  skill: 'Skill',
  prompt: $t('提示词'),
})[props.item.kind])

const defaultIconByKind = {
  script: {
    name: 'roxy-agent/rx-ic-scripts',
    background: '#d1e9ff',
    color: '#175cd3',
  },
  skill: {
    name: 'roxy-agent/rx-ic-skills',
    background: '#fce7f6',
    color: '#c11574',
  },
  prompt: {
    name: 'roxy-agent/rx-ic-prompts',
    background: '#fef0c7',
    color: '#b54708',
  },
} as const satisfies Record<TemplateKind, {
  name: string
  background: string
  color: string
}>

const templateIcon = computed(() => pickTemplateThemeValue(
  props.item.iconInfo?.icon,
  themeStore.realTheme === 'dark',
))
const templateImageIcon = computed(() => templateIcon.value && isTemplateImageIconSource(templateIcon.value) ? templateIcon.value : '')
const templateSvgIcon = computed(() => templateIcon.value && !isTemplateImageIconSource(templateIcon.value) ? templateIcon.value : '')
const defaultIcon = computed(() => defaultIconByKind[props.item.kind])
const descriptionText = computed(() => props.item.description || $t('暂无描述'))
const titleRef = useTemplateRef<HTMLElement>('titleRef')
const descriptionRef = useTemplateRef<HTMLElement>('descriptionRef')
const titleOverflowed = ref(false)
const descriptionOverflowed = ref(false)
let titleResizeObserver: ResizeObserver | undefined
let descriptionResizeObserver: ResizeObserver | undefined

function updateTitleOverflow() {
  const element = titleRef.value
  titleOverflowed.value = Boolean(
    element && element.scrollWidth > element.clientWidth + 1,
  )
}

function updateDescriptionOverflow() {
  const element = descriptionRef.value
  descriptionOverflowed.value = Boolean(
    element && (
      element.scrollHeight > element.clientHeight + 1
      || element.scrollWidth > element.clientWidth + 1
    ),
  )
}

function handleGet() {
  if (!props.installed)
    emit('get', props.item.id)
}

function handleRun() {
  emit('run', props.item.id)
}

watch(() => props.item.title, () => nextTick(updateTitleOverflow), { flush: 'post' })
watch(descriptionText, () => nextTick(updateDescriptionOverflow), { flush: 'post' })

onMounted(() => {
  titleResizeObserver = new ResizeObserver(updateTitleOverflow)
  if (titleRef.value)
    titleResizeObserver.observe(titleRef.value)

  descriptionResizeObserver = new ResizeObserver(updateDescriptionOverflow)
  if (descriptionRef.value)
    descriptionResizeObserver.observe(descriptionRef.value)

  updateTitleOverflow()
  updateDescriptionOverflow()
})

onBeforeUnmount(() => {
  titleResizeObserver?.disconnect()
  descriptionResizeObserver?.disconnect()
})
</script>

<template>
  <RxCard :closable="false" class="template-store-card">
    <header class="template-store-card__header">
      <div class="template-store-card__identity">
        <div class="template-store-card__avatar">
          <img v-if="templateImageIcon" :src="templateImageIcon" :alt="item.title">
          <SvgIcon
            v-else-if="templateSvgIcon"
            :name="(templateSvgIcon as any)"
            size="44"
            color="var(--color-text-primary)"
            aria-hidden="true"
          />
          <SvgIcon
            v-else
            :name="defaultIcon.name"
            size="44"
            :color="defaultIcon.color"
            aria-hidden="true"
          />
        </div>

        <div class="template-store-card__title-group">
          <div class="template-store-card__title-row">
            <AgentTooltip
              :content="item.title"
              :disabled="!titleOverflowed"
              content-class="template-store-card__title-tooltip"
              placement="top-start"
              trigger-class="template-store-card__title-trigger"
            >
              <h2 ref="titleRef">{{ item.title }}</h2>
            </AgentTooltip>
            <SvgIcon
              v-if="item.official"
              class="template-store-card__official"
              name="roxy-agent/rx-ic-official-badge"
              size="18"
            />
            <SvgIcon v-if="item.isHot" class="template-store-card__hot" name="base/fire" size="16" />
          </div>
          <!-- <p class="template-store-card__author">
            by RoxyBrowser
          </p> -->
        </div>
      </div>

      <div class="template-store-card__actions">
        <button
          class="template-store-card__get-button"
          type="button"
          :disabled="installed || Boolean(busyAction)"
          :aria-busy="busyAction === 'get'"
          @click="handleGet"
        >
          {{ installed ? $t('已获取') : busyAction === 'get' ? $t('获取中...') : $t('获取') }}
        </button>
        <button
          class="template-store-card__run-button"
          type="button"
          :disabled="Boolean(busyAction)"
          :aria-busy="busyAction === 'run'"
          @click="handleRun"
        >
          {{ busyAction === 'run' ? $t('准备中...') : installed ? $t('运行') : $t('获取并运行') }}
        </button>
      </div>
    </header>

    <div class="template-store-card__divider" />

    <div class="template-store-card__tags">
      <!-- <RxTag class="template-store-card__kind" :label="kindLabel" readonly /> -->
      <RxTag v-for="tag in item.labels" :key="tag.id" :label="tag.label" readonly />
    </div>

    <AgentTooltip
      :content="descriptionText"
      :disabled="!descriptionOverflowed"
      content-class="template-store-card__description-tooltip"
      placement="top-start"
      trigger-class="template-store-card__description-trigger"
    >
      <p
        ref="descriptionRef"
        class="template-store-card__description"
      >
        {{ descriptionText }}
      </p>
    </AgentTooltip>
  </RxCard>
</template>

<style lang="scss" scoped>
:global(body.agent-console-window) {
  --template-run-hover-bg: #fce7f6;
}

:global(html[data-theme='dark'] body.agent-console-window),
:global(html.app-dark body.agent-console-window) {
  --template-run-hover-bg: #300f27;
}

:global(.template-store-card.rx-card) {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 190px;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  box-shadow: none;
  overflow: hidden;
}

.template-store-card__header {
  display: flex;
  width: 100%;
  height: 44px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.template-store-card__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
}

.template-store-card__avatar {
  display: flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--color-bg-tertiary);

  img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
}

.template-store-card__title-group {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.template-store-card__title-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;

  :deep(.template-store-card__title-trigger) {
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }

  h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.template-store-card__official,
.template-store-card__hot {
  flex: 0 0 auto;
}

.template-store-card__author {
  width: 100%;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-quaternary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-store-card__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.template-store-card__get-button,
.template-store-card__run-button {
  box-sizing: border-box;
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  outline: 0;
  box-shadow: none;
  cursor: pointer;
  appearance: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.template-store-card__get-button {
  padding: 5px 10px;
  border: 1px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);

  &:not(:disabled):hover {
    border-color: var(--color-border-secondary);
    color: var(--color-text-primary);
    background: var(--color-bg-quaternary);
  }

  &:disabled {
    color: var(--color-text-disabled);
    cursor: default;
  }
}

.template-store-card__run-button {
  overflow: hidden;
  padding: 6px 10px;
  border: 1px solid #ee46bc;
  color: #ee46bc;
  background-color: transparent;

  &:not(:disabled):hover {
    background: var(--template-run-hover-bg);
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
}

.template-store-card__divider {
  width: 100%;
  height: 0;
  flex: 0 0 0;
  border-top: 1px dashed var(--color-border-secondary);
}

.template-store-card__tags {
  display: flex;
  width: 100%;
  height: 24px;
  min-width: 0;
  flex: 0 0 24px;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  overflow: hidden;

  :deep(.rx-tag) {
    flex: 0 1 auto;
    min-width: 0;
    padding: 2px 6px;
    border: 0;
    border-radius: 8px;
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    white-space: nowrap;
  }

  :deep(.rx-tag-label) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :deep(.template-store-card__kind.rx-tag) {
    flex: 0 0 auto;
  }
}

.template-store-card__description {
  display: -webkit-box;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-quaternary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

:deep(.template-store-card__description-trigger) {
  display: flex;
  width: 100%;
  height: 60px;
  flex: 0 0 60px;
  min-width: 0;
}
</style>

<style lang="scss">
.template-store-card__title-tooltip,
.template-store-card__description-tooltip {
  max-width: min(320px, calc(100vw - 24px));
}
</style>
