<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import type { AgentScriptSelfDescription } from '../../api'
import { useAgentConsoleApi } from '../../api'
import { isReservedOfficialTemplateSlug } from '../../my-templates'
import { pickLocalized } from '../../template-store'
import { useSimpleLocale } from '/@/stores/locale'
import AgentButton from '../form/AgentButton.vue'
import './agent-dialog.scss'

interface UploadScriptDialogData {
  onUpload?: (file: File, parsed: AgentScriptSelfDescription) => boolean | Promise<boolean>
}

const SCRIPT_TEMPLATE = `import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({
  name: 'My script',
  description: 'What it does',
  version: '1.0.0',
})

defineParams({
  type: 'object',
  properties: {},
})

export async function main() {
  // Write your automation here.
}
`

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const dialogData = (dialogRef?.value.data ?? {}) as UploadScriptDialogData
const agentApi = useAgentConsoleApi()
const localeStore = useSimpleLocale()
const method = ref<'paste' | 'file'>('paste')
const source = ref('')
const selectedFile = ref<File>()
const fileInput = ref<HTMLInputElement>()
const parsed = ref<AgentScriptSelfDescription>()
const errorMessage = ref('')
const parsing = ref(false)
const uploading = ref(false)
const isDraggingFile = ref(false)
const parsedName = computed(() => pickLocalized(parsed.value?.metadata.name, localeStore.currentLocale))
const parsedDescription = computed(() => pickLocalized(parsed.value?.metadata.description, localeStore.currentLocale))
let parseRequestId = 0
let dragDepth = 0

function closeDialog() {
  dialogRef?.value.close()
}

function localizedParseError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('脚本语法解析失败'))
    return $t('脚本语法解析失败，请检查代码语法')
  if (message.includes('main(options)'))
    return $t('脚本需要导出 main(options) 函数')
  if (message.includes('defineMetadata'))
    return $t('脚本缺少有效的 defineMetadata 配置')
  if (message.includes('defineParams'))
    return $t('脚本缺少有效的 defineParams 配置')
  if (message.includes('静态') || message.includes('模板字符串'))
    return $t('自描述配置仅支持静态字面量')
  return $t('脚本解析失败，请检查脚本格式')
}

async function parseSource(value: string) {
  const requestId = ++parseRequestId
  errorMessage.value = ''
  parsing.value = true
  try {
    const result = await agentApi.scriptSelfDescription(value)
    if (requestId !== parseRequestId)
      return undefined
    parsed.value = result
    return result
  }
  catch (error) {
    if (requestId !== parseRequestId)
      return undefined
    parsed.value = undefined
    errorMessage.value = localizedParseError(error)
    return undefined
  }
  finally {
    if (requestId === parseRequestId)
      parsing.value = false
  }
}

async function loadFile(file: File) {
  if (!/\.(?:js|ts)$/i.test(file.name)) {
    errorMessage.value = $t('仅支持 .js 或 .ts 脚本文件')
    return
  }
  selectedFile.value = file
  parsed.value = undefined
  source.value = await file.text()
  await parseSource(source.value)
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    await loadFile(file)
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function resetDragState() {
  dragDepth = 0
  isDraggingFile.value = false
}

function handleDragEnter(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  dragDepth += 1
  isDraggingFile.value = true
}

function handleDragOver(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'copy'
}

function handleDragLeave(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0)
    isDraggingFile.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  resetDragState()
  if (file)
    await loadFile(file)
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([SCRIPT_TEMPLATE], { type: 'video/mp2t' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'roxy-script-template.ts'
  anchor.click()
  URL.revokeObjectURL(url)
}

function openDocumentation() {
  window.open(localeStore.getOfficialFaqWebsite('/features/automation-script-development.html'), '_blank')
}

async function uploadScript() {
  const normalizedSource = source.value.trim()
  if (!normalizedSource) {
    errorMessage.value = $t('请输入或上传脚本内容')
    return
  }
  const selfDescription = parsed.value ?? await parseSource(normalizedSource)
  if (!selfDescription)
    return
  if (isReservedOfficialTemplateSlug(selfDescription.metadata.slug)) {
    errorMessage.value = $t('脚本 slug 不能以 official- 开头，请修改脚本中的 defineMetadata.slug 后重试')
    return
  }

  const filename = method.value === 'file' && selectedFile.value
    ? selectedFile.value.name
    : 'custom-template.ts'
  const file = new File([source.value], filename, {
    type: filename.toLowerCase().endsWith('.js') ? 'application/javascript' : 'video/mp2t',
    lastModified: selectedFile.value?.lastModified ?? Date.now(),
  })

  uploading.value = true
  try {
    const succeeded = await dialogData.onUpload?.(file, selfDescription)
    if (succeeded !== false)
      closeDialog()
  }
  finally {
    uploading.value = false
  }
}

watch(source, () => {
  if (method.value === 'paste') {
    parseRequestId++
    parsed.value = undefined
    parsing.value = false
    errorMessage.value = ''
  }
})
</script>

<template>
  <div class="agent-console-dialog__shell upload-script-dialog">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">
        {{ $t('上传脚本') }}
      </h2>
      <button class="agent-console-dialog__close" type="button" :aria-label="$t('关闭上传脚本弹窗')" @click="closeDialog" />
    </header>

    <main class="agent-console-dialog__body upload-script-dialog__body">
      <div class="upload-script-dialog__tools">
        <AgentButton
          variant="secondary"
          icon="roxy-agent/rx-ic-script-doc"
          :label="$t('脚本开发文档')"
          @click="openDocumentation"
        />
        <AgentButton
          variant="secondary"
          icon="base/rx_ic_download"
          :label="$t('下载脚本模板')"
          @click="downloadTemplate"
        />
      </div>

      <div class="upload-script-dialog__divider" aria-hidden="true" />

      <div class="upload-script-dialog__form">
        <section class="upload-script-dialog__field">
          <label>{{ $t('脚本名称') }}</label>
          <input
            class="upload-script-dialog__name-input"
            :value="parsedName"
            :placeholder="$t('解析脚本后自动填充')"
            readonly
            aria-readonly="true"
          >
        </section>

        <section class="upload-script-dialog__field">
          <label>{{ $t('上传方式') }}</label>
          <div class="upload-script-dialog__methods" role="radiogroup" :aria-label="$t('上传方式')">
            <label :class="{ active: method === 'paste' }">
              <input v-model="method" type="radio" name="upload-script-method" value="paste">
              <span>{{ $t('粘贴代码') }}</span>
            </label>
            <label :class="{ active: method === 'file' }">
              <input v-model="method" type="radio" name="upload-script-method" value="file">
              <span>{{ $t('从本地设备上传') }}</span>
            </label>
          </div>
        </section>

        <section class="upload-script-dialog__field">
          <label>{{ method === 'paste' ? $t('粘贴脚本代码') : $t('脚本文件') }}</label>
          <textarea
            v-if="method === 'paste'"
            v-model="source"
            class="upload-script-dialog__editor"
            :placeholder="$t('请在此粘贴符合格式要求的脚本...')"
            spellcheck="false"
          />
          <button
            v-else
            class="upload-script-dialog__dropzone"
            :class="{ 'is-dragging': isDraggingFile }"
            type="button"
            @click="fileInput?.click()"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
            @dragover="handleDragOver"
            @drop="handleDrop"
          >
            <SvgIcon name="extension/rx_ic_upload" size="20" />
            <span>{{ selectedFile?.name || $t('选择 .js 或 .ts 文件') }}</span>
            <small>{{ $t('点击上传文件，也可直接拖拽上传') }}</small>
          </button>
          <input ref="fileInput" type="file" accept=".js,.ts,application/javascript,text/javascript,application/typescript" hidden @change="selectFile">
        </section>

        <section v-if="parsed" class="upload-script-dialog__result">
          <div>
            <span>{{ $t('脚本描述') }}</span>
            <p>{{ parsedDescription || $t('暂无描述') }}</p>
          </div>
          <div>
            <span>{{ $t('脚本参数') }}</span>
            <pre>{{ JSON.stringify(parsed.paramsSchema, null, 2) }}</pre>
          </div>
        </section>

        <p v-if="errorMessage" class="upload-script-dialog__error" role="alert">
          {{ errorMessage }}
        </p>
      </div>
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button" type="button" :disabled="uploading || parsing" @click="closeDialog">
          {{ $t('取消') }}
        </button>
        <button class="agent-console-dialog__button primary" type="button" :disabled="uploading || parsing" @click="uploadScript">
          {{ parsing ? $t('解析中...') : uploading ? $t('上传中...') : $t('上传脚本') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.upload-script-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.upload-script-dialog__tools {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.upload-script-dialog__divider {
  width: 100%;
  height: 0;
  border-top: 1px dashed var(--color-border-secondary);
}

.upload-script-dialog__form {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
}

.upload-script-dialog__result {
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-quaternary);

  p {
    margin: 4px 0 0;
    color: var(--color-text-tertiary);
  }
}

.upload-script-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  > label {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
}

.upload-script-dialog__methods {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;

  > label {
    position: relative;
    box-sizing: border-box;
    display: flex;
    height: 32px;
    min-width: 0;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 10px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    font-family: inherit;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    cursor: pointer;

    input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      cursor: pointer;
      opacity: 0;
    }

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.active {
      border-color: var(--color-border-primary-inverse);
      color: var(--color-text-primary-inverse);
      background: var(--color-bg-primary-inverse);
    }

    &:focus-within {
      outline: 2px solid color-mix(in srgb, var(--color-border-primary-inverse) 12%, transparent);
      outline-offset: 2px;
    }
  }
}

.upload-script-dialog__name-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  outline: none;

  &::placeholder {
    color: var(--color-text-disabled);
    opacity: 1;
  }

  &:focus {
    border-color: var(--color-border-primary);
  }
}

.upload-script-dialog__editor {
  box-sizing: border-box;
  width: 100%;
  height: 160px;
  min-height: 160px;
  padding: 10px;
  resize: none;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  color: var(--color-text-primary);
  outline: none;
  background: var(--color-bg-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;

  &::placeholder {
    color: var(--color-text-disabled);
  }

  &:focus {
    border-color: var(--color-border-primary-inverse);
  }
}

.upload-script-dialog__dropzone {
  display: flex;
  height: 160px;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  border: 1px dashed #a3a3a3;
  border-radius: 10px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;

  small {
    color: var(--color-text-disabled);
    font-size: 12px;
    line-height: 16px;
  }

  &:hover,
  &:focus-visible,
  &.is-dragging {
    border-color: var(--color-border-primary-inverse);
    color: var(--color-text-primary);
    background: var(--color-bg-quaternary);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-border-primary-inverse) 12%, transparent);
    outline-offset: 2px;
  }
}

.upload-script-dialog__result {
  display: flex;
  flex-direction: column;
  gap: 10px;

  span {
    color: var(--color-text-quaternary);
    font-size: 12px;
  }

  pre {
    max-height: 120px;
    margin: 4px 0 0;
    overflow: auto;
    color: var(--color-text-tertiary);
    font-size: 11px;
    line-height: 16px;
    white-space: pre-wrap;
  }
}

.upload-script-dialog__error {
  margin: 0;
  color: #f04438;
  font-size: 12px;
  line-height: 16px;
}
</style>
