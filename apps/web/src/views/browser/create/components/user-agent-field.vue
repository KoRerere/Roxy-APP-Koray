<script lang="ts" setup>
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

const props = withDefaults(
  defineProps<{
    input: Record<string, any>
    inputsGroup?: any[]
  }>(),
  { inputsGroup: () => [] },
)

/** RyForm slot 下发的 field，`value` 与表单双向绑定（toRef 避免直接对 prop 子字段 v-model） */
const uaModel = toRef(props.input, 'value')
const uaEditing = ref(false)
const uaTextareaRef = ref<InstanceType<typeof RxInputTextarea> | null>(null)
const uaControlRowRef = ref<HTMLElement | null>(null)

function uaCollapsedDisplay(value: unknown) {
  const s = typeof value === 'string' ? value.trim() : ''
  return s || '\u00A0'
}

function uaCollapsedIsEmpty(value: unknown) {
  const s = typeof value === 'string' ? value.trim() : ''
  return !s
}

function onUaInputChange(input: any) {
  if (input.invalid)
    input.invalid = false
  input.change?.(input, props.inputsGroup)
}

function onUaBlur(evt: FocusEvent) {
  const rt = evt.relatedTarget as Node | null
  if (rt && uaControlRowRef.value?.contains(rt))
    return
  uaEditing.value = false
}

function focusUaTextarea() {
  const root = uaTextareaRef.value?.$el as HTMLElement | undefined
  root?.querySelector?.('textarea')?.focus()
}

function openUaEdit() {
  uaEditing.value = true
  nextTick(() => focusUaTextarea())
}

async function onUaShuffle(input: any) {
  try {
    await input.iconClick?.(input, props.inputsGroup)
  }
  catch {
    return
  }
  uaEditing.value = true
  await nextTick()
  focusUaTextarea()
}
</script>

<template>
  <div class="user-agent-field flex min-w-0 w-full px-4">
    <div class="mr-2 tt-primary text-3.25 leading-32px rx-label">
      {{ input.label }}
    </div>
    <div ref="uaControlRowRef" class="ua-control-row flex min-w-0 w-full items-start gap-2">
      <div class="ua-field-slot min-w-0 w-full flex-1 overflow-hidden">
        <!-- 与 RxInputTextarea 相同：IconField w-full + sm，避免 flex 子项 min-width:auto 被长 UA 撑开 -->
        <IconField v-if="!uaEditing" class="ua-collapsed-iconfield min-w-0 w-full max-w-full" :pt="{ root: 'sm' }">
          <button type="button" class="ua-collapsed-trigger cursor-text text-left transition-[box-shadow]" @click="openUaEdit">
            <span class="ua-collapsed-text block min-w-0 max-w-full truncate font-[Inter] text-3 leading-5" :class="{ 'ua-collapsed-trigger--empty': uaCollapsedIsEmpty(uaModel) }">{{
              uaCollapsedDisplay(uaModel) }}</span>
          </button>
        </IconField>
        <RxInputTextarea v-else ref="uaTextareaRef" v-model="uaModel" class="min-w-0 max-w-full" v-bind="input" @blur="onUaBlur" @change="onUaInputChange(input)" />
      </div>
      <RxButton severity="secondary" variant="outlined" icon="base/rx_ic_shuffle" :label="$t('随机')" class="shrink-0" @click="onUaShuffle(input)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user-agent-field {
  // 参与父级 flex 时允许被压缩，避免长 UA 把整列撑宽
  min-width: 0;
}

.ua-collapsed-iconfield {
  :deep(.p-iconfield) {
    display: flex;
    min-width: 0;
    max-width: 100%;
    width: 100%;
    overflow: hidden;
  }
}

.ua-collapsed-trigger {
  margin: 0;
  flex: 1 1 0%;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font: inherit;
  color: var(--colors-text-text-primary);
  appearance: none;
  background: var(--colors-background-bg-action);
  border-style: solid;
  border-width: var(--p-textarea-border-width, var(--p-inputtext-border-width, 1px));
  border-color: var(--p-textarea-border-color, var(--p-inputtext-border-color, var(--colors-border-border-base)));
  border-radius: var(
    --Component-Colors-TextInput-radius-radius-md,
    var(--p-textarea-border-radius, var(--p-inputtext-border-radius, 6px))
  );
  padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
  min-height: calc(var(--Line-Height-text-lg, 20px) + 2 * var(--spacing-md, 6px));
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(
      --p-textarea-hover-border-color,
      var(--p-inputtext-hover-border-color, var(--colors-border-border-strong, var(--colors-border-border-base)))
    );
  }

  &:focus-visible {
    outline: none;
    border-color: var(
      --p-textarea-focus-border-color,
      var(--p-inputtext-focus-border-color, var(--colors-border-border-focus, #3b82f6))
    );
    box-shadow: var(
      --p-textarea-focus-ring-shadow,
      var(--p-inputtext-focus-ring-shadow, 0 0 0 2px rgb(59 130 246 / 0.25))
    );
  }
}

.ua-collapsed-text {
  // 明确单行省略（与 Tailwind truncate 叠加，保证极长无空格串也不撑开）
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ua-collapsed-trigger--empty {
  color: var(--colors-text-text-placeholder, #7c8387);
}

// 聚焦态：取消 cols 等带来的固有最小宽度，宽度由列布局决定（与外层输入一致）
.ua-field-slot {
  :deep(.p-iconfield) {
    min-width: 0;
    max-width: 100%;
  }

  :deep(.p-textarea) {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
