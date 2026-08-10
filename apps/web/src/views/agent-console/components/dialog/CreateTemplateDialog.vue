<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import type { JsonFormsChangeEvent } from '@jsonforms/vue'
import type { AgentScriptSelfDescription } from '../../api'
import type {
  CustomTemplatePayload,
  MyTemplateItem,
  MyTemplateKind,
  TemplateAssetUpload,
} from '../../my-templates'
import type { ScriptParamsSchema } from '../../script-template-params'
import type { OfficialTemplate } from '../../template-store'
import { useDialog } from 'primevue/usedialog'
import { useAgentConsoleApi } from '../../api'
import {
  isReservedOfficialTemplateSlug,
  mapMyTemplateItem,
  normalizeTemplateSlug,
  readTemplateAssetMutation,
  readUserTemplateMutation,
} from '../../my-templates'
import {
  buildScriptParams,
  createScriptParamsData,
  isScriptParamsRecord,
  parseScriptParamsSchema,
  ScriptParamsFormError,
} from '../../script-template-params'
import { pickLocalized, pickOfficialTemplatePrompt, readCatalogList } from '../../template-store'
import { useSimpleLocale } from '/@/stores/locale'
import AgentFormField from '../form/AgentFormField.vue'
import AgentInput from '../form/AgentInput.vue'
import AgentSelect from '../form/AgentSelect.vue'
import ChatComposer from '../ChatComposer.vue'
import ScriptSchemaForm from '../form/ScriptSchemaForm.vue'
import CreateTemplateFormSkeleton from '../skeleton/CreateTemplateFormSkeleton.vue'
import AgentTooltip from '../AgentTooltip.vue'
import UploadScriptDialog from './UploadScriptDialog.vue'
import './agent-dialog.scss'

interface CreateTemplateDialogData {
  initialKind?: MyTemplateKind
  initialPrompt?: string
  lockKind?: boolean
  template?: MyTemplateItem
  officialTemplate?: OfficialTemplate
  lockSource?: boolean
  /** 编辑模式下，由对话框内部加载最新详情（避免父级先阻塞再打开） */
  loadDetail?: boolean
  submitMode?: 'run' | 'save'
  /** 只读模式：仅展示模板参数，禁用所有编辑与保存入口 */
  readonly?: boolean
  onCancel?: () => void | Promise<void>
  onSave?: (payload: CustomTemplatePayload) => boolean | void | Promise<boolean | void>
}

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const dialogData = (dialogRef?.value.data ?? {}) as CreateTemplateDialogData
const editingTemplate = dialogData.template
const initialOfficialTemplate = dialogData.officialTemplate
const needsDetailLoad = Boolean(dialogData.loadDetail && editingTemplate)
const agentApi = useAgentConsoleApi()
const nestedDialog = useDialog()
const localeStore = useSimpleLocale()

const templateType = ref<MyTemplateKind>(editingTemplate?.kind ?? normalizeInitialKind(initialOfficialTemplate?.templateType) ?? dialogData.initialKind ?? 'script')
const name = ref(needsDetailLoad ? '' : (editingTemplate?.name ?? pickLocalized(initialOfficialTemplate?.name, localeStore.currentLocale) ?? ''))
const description = ref(needsDetailLoad ? '' : (editingTemplate?.description ?? pickLocalized(initialOfficialTemplate?.description, localeStore.currentLocale) ?? ''))
const prompt = ref(needsDetailLoad
  ? ''
  : (typeof editingTemplate?.metadata.prompt === 'string'
      ? editingTemplate.metadata.prompt
      : (dialogData.initialPrompt
          ?? pickOfficialTemplatePrompt(initialOfficialTemplate, localeStore.currentLocale))))
const sourceValue = ref<number | 'custom' | undefined>(needsDetailLoad
  ? undefined
  : (editingTemplate?.officialTemplateId
      ?? initialOfficialTemplate?.id
      ?? (editingTemplate ? 'custom' : undefined)))
const officialTemplates = ref<OfficialTemplate[]>(initialOfficialTemplate ? [initialOfficialTemplate] : [])
const customAsset = ref<TemplateAssetUpload>()
const customMetadata = ref<Record<string, unknown>>({})
const loadedDetail = ref<MyTemplateItem | undefined>()
const scriptParams = ref<Record<string, unknown>>(needsDetailLoad
  ? {}
  : (editingTemplate?.metadata.params && typeof editingTemplate.metadata.params === 'object' && !Array.isArray(editingTemplate.metadata.params)
      ? { ...editingTemplate.metadata.params as Record<string, unknown> }
      : {}))
const scriptParamsData = ref<Record<string, unknown>>({})
const scriptParamsErrors = ref<NonNullable<JsonFormsChangeEvent['errors']>>([])
const showScriptParamsValidation = ref(false)
const showScriptFormValidation = ref(false)
const scriptSchemaError = ref('')
const loadingSources = ref(false)
const loadingDetail = ref(needsDetailLoad)
const detailError = ref('')
const uploadingSkill = ref(false)
const isDraggingSkillFile = ref(false)
const saving = ref(false)
const formError = ref('')
const skillInput = ref<HTMLInputElement>()
let sourceRequest = 0
let skillDragDepth = 0

const isEditing = computed(() => Boolean(editingTemplate))
const isReadonly = computed(() => Boolean(dialogData.readonly))
const sourceLocked = computed(() => isEditing.value || Boolean(dialogData.lockSource))
const contentPanelLoading = computed(() => loadingSources.value && !sourceLocked.value && !loadingDetail.value)
const formReady = computed(() => !loadingDetail.value && !detailError.value)
const typeCards = computed(() => ([
  {
    value: 'script' as const,
    label: $t('脚本'),
    tooltip: $t('更稳定的自动化操作方式，适合养号等标准化任务'),
  },
  {
    value: 'skill' as const,
    label: 'Skill',
    tooltip: $t('AI 深度参与的自动化，适合调研和分析等任务'),
  },
  { value: 'prompt' as const, label: $t('提示词'), tooltip: '' },
]))
const sourceOptions = computed(() => [
  ...officialTemplates.value.map(row => ({
    label: pickLocalized(row.name, localeStore.currentLocale) || row.slug,
    value: row.id,
  })),
  ...(customAsset.value ? [{ label: customAsset.value.filename, value: 'custom' as const }] : []),
])
const selectedOfficialTemplate = computed(() => typeof sourceValue.value === 'number'
  ? officialTemplates.value.find(row => row.id === sourceValue.value)
  : undefined)
const activeMetadata = computed<Record<string, unknown>>(() => {
  if (loadedDetail.value)
    return loadedDetail.value.metadata
  if (editingTemplate)
    return editingTemplate.metadata
  return selectedOfficialTemplate.value?.metadata ?? customMetadata.value
})
const sourceLockedLabel = computed(() => {
  if (typeof sourceValue.value === 'number') {
    return sourceOptions.value.find(option => option.value === sourceValue.value)?.label
      || `${$t('官方模板')} #${sourceValue.value}`
  }
  const source = loadedDetail.value ?? editingTemplate
  const filename = source && typeof source.metadata.filename === 'string' ? source.metadata.filename : ''
  return filename || $t('自定义上传')
})
const scriptFormValidationError = computed(() => {
  if (!showScriptFormValidation.value || templateType.value !== 'script')
    return ''
  if (!name.value.trim())
    return $t('请输入模板名称')
  if (!isEditing.value && sourceValue.value == null)
    return $t('请选择或上传脚本')
  if (scriptParamsErrors.value.length) {
    return $t('有 {count} 个脚本参数填写有误，请检查标红内容后重试。', {
      count: scriptParamsErrors.value.length,
    })
  }
  return ''
})
const displayedFormError = computed(() => formError.value || scriptFormValidationError.value)

function normalizeInitialKind(value?: string): MyTemplateKind | undefined {
  return value === 'script' || value === 'skill' || value === 'prompt' ? value : undefined
}
const detailDescription = computed(() => {
  if (selectedOfficialTemplate.value)
    return pickLocalized(selectedOfficialTemplate.value.description, localeStore.currentLocale)
  if (templateType.value === 'skill') {
    const metadata = activeMetadata.value.skillMetadata
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const value = (metadata as Record<string, unknown>).description
      if (typeof value === 'string')
        return value
    }
  }
  return description.value
})
const scriptSchema = computed<ScriptParamsSchema | null>(() => {
  try {
    return parseScriptParamsSchema(activeMetadata.value.optionsSchema)
  }
  catch {
    return null
  }
})
function hydrateScriptParamsForm(params: Record<string, unknown> = scriptParams.value) {
  scriptParamsData.value = scriptSchema.value
    ? createScriptParamsData(scriptSchema.value, params)
    : {}
  scriptParamsErrors.value = []
  showScriptParamsValidation.value = false
  showScriptFormValidation.value = false
  scriptSchemaError.value = ''
}

function updateScriptParamsForm(event: JsonFormsChangeEvent) {
  scriptParamsData.value = isScriptParamsRecord(event.data) ? event.data : {}
  scriptParamsErrors.value = event.errors ?? []
}

function hydrateFromTemplate(template: MyTemplateItem) {
  loadedDetail.value = template
  name.value = template.name
  description.value = template.description
  prompt.value = typeof template.metadata.prompt === 'string' ? template.metadata.prompt : ''
  sourceValue.value = template.officialTemplateId ?? 'custom'
  scriptParams.value = template.metadata.params && typeof template.metadata.params === 'object' && !Array.isArray(template.metadata.params)
    ? { ...template.metadata.params as Record<string, unknown> }
    : {}
  hydrateScriptParamsForm()
}

async function loadTemplateDetail(templateId: number) {
  loadingDetail.value = true
  detailError.value = ''
  try {
    const response = await agentApi.userTemplates.getUserTemplate({ templateId })
    const detail = readUserTemplateMutation(response, $t('加载我的模板失败'))
    const detailItem = mapMyTemplateItem(detail)
    if (!detailItem)
      throw new Error($t('加载我的模板失败'))
    hydrateFromTemplate(detailItem)
  }
  catch (error) {
    console.error('Failed to load user template detail', error)
    detailError.value = error instanceof Error ? error.message : $t('加载我的模板失败')
  }
  finally {
    loadingDetail.value = false
  }
}

function retryLoadDetail() {
  if (editingTemplate)
    void loadTemplateDetail(editingTemplate.id)
}

async function loadOfficialSources(kind: MyTemplateKind) {
  if (kind === 'prompt') {
    officialTemplates.value = []
    return
  }
  const currentRequest = ++sourceRequest
  loadingSources.value = true
  try {
    const response = await agentApi.templates.listOfficialTemplates({ templateType: kind })
    const rows = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))
    if (currentRequest === sourceRequest)
      officialTemplates.value = rows.filter(row => row.templateType === kind)
  }
  catch (error) {
    if (currentRequest === sourceRequest) {
      officialTemplates.value = []
      formError.value = error instanceof Error ? error.message : $t('加载官方模板失败')
    }
  }
  finally {
    if (currentRequest === sourceRequest)
      loadingSources.value = false
  }
}

function isTypeCardDisabled(_kind: MyTemplateKind) {
  return sourceLocked.value || saving.value || Boolean(dialogData.lockKind)
}

function selectType(kind: MyTemplateKind) {
  if (sourceLocked.value || dialogData.lockKind || saving.value || templateType.value === kind)
    return
  templateType.value = kind
  sourceValue.value = undefined
  customAsset.value = undefined
  customMetadata.value = {}
  scriptParams.value = {}
  description.value = ''
  prompt.value = ''
  formError.value = ''
  resetSkillDragState()
  hydrateScriptParamsForm({})
  void loadOfficialSources(kind)
}

function applyOfficialSource() {
  // 编辑模式下表单字段以加载到的详情为准，不因 sourceValue 初始化而回填官方模板原始值
  if (isEditing.value)
    return
  const source = selectedOfficialTemplate.value
  if (!source)
    return
  name.value = pickLocalized(source.name, localeStore.currentLocale) || source.slug
  description.value = pickLocalized(source.description, localeStore.currentLocale)
  scriptParams.value = {}
  hydrateScriptParamsForm({})
  if (templateType.value === 'skill')
    prompt.value = pickOfficialTemplatePrompt(source, localeStore.currentLocale)
}

async function uploadScriptFile(file: File, parsed: AgentScriptSelfDescription) {
  formError.value = ''
  if (isReservedOfficialTemplateSlug(parsed.metadata.slug)) {
    formError.value = $t('脚本 slug 不能以 official- 开头，请修改脚本中的 defineMetadata.slug 后重试')
    return false
  }
  try {
    const response = await agentApi.userTemplates.uploadUserTemplateScript({ file })
    const asset = readTemplateAssetMutation(response, $t('上传脚本失败'))
    const slug = normalizeTemplateSlug(parsed.metadata.slug)
    customAsset.value = asset
    customMetadata.value = {
      fileId: asset.fileId,
      ossUrl: asset.ossUrl,
      sha512: asset.sha512,
      contentType: asset.contentType,
      fileSize: asset.fileSize,
      filename: asset.filename,
      optionsSchema: JSON.stringify(parsed.paramsSchema),
      ...(slug ? { slug } : {}),
    }
    scriptParams.value = {}
    sourceValue.value = 'custom'
    name.value = pickLocalized(parsed.metadata.name, localeStore.currentLocale) || name.value
    description.value = parsed.metadata.description
      ? pickLocalized(parsed.metadata.description, localeStore.currentLocale)
      : ''
    hydrateScriptParamsForm({})
    return true
  }
  catch (error) {
    formError.value = error instanceof Error ? error.message : $t('上传脚本失败')
    return false
  }
}

function openScriptUpload() {
  nestedDialog.open(UploadScriptDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(540px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-upload-script-dialog',
        content: '!p-0 !overflow-hidden'
      },
    },
    data: { onUpload: uploadScriptFile },
  })
}

async function uploadSkill(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    formError.value = $t('仅支持 .zip Skill 包')
    return
  }

  uploadingSkill.value = true
  formError.value = ''
  try {
    const response = await agentApi.userTemplates.uploadUserTemplateSkill({ file })
    const asset = readTemplateAssetMutation(response, $t('上传 Skill 失败'))
    const slug = normalizeTemplateSlug(asset.packageSlug)
    customAsset.value = asset
    customMetadata.value = {
      fileId: asset.fileId,
      ossUrl: asset.ossUrl,
      sha512: asset.sha512,
      contentType: asset.contentType,
      fileSize: asset.fileSize,
      filename: asset.filename,
      ...(slug ? { slug } : {}),
      skillMetadata: asset.skillMetadata ?? {},
      packageSlug: asset.packageSlug,
      fileCount: asset.fileCount,
      files: asset.files,
      skillMdPath: asset.skillMdPath,
    }
    prompt.value = ''
    sourceValue.value = 'custom'
    name.value = asset.packageName || name.value
    description.value = asset.packageDescription || ''
  }
  catch (error) {
    formError.value = error instanceof Error ? error.message : $t('上传 Skill 失败')
  }
  finally {
    uploadingSkill.value = false
  }
}

async function uploadSkillFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    await uploadSkill(file)
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function canDropSkillFile(event: DragEvent) {
  return templateType.value === 'skill'
    && !sourceLocked.value
    && !isReadonly.value
    && !saving.value
    && !uploadingSkill.value
    && isFileDrag(event)
}

function resetSkillDragState() {
  skillDragDepth = 0
  isDraggingSkillFile.value = false
}

function handleSkillDragEnter(event: DragEvent) {
  if (!canDropSkillFile(event))
    return
  event.preventDefault()
  skillDragDepth += 1
  isDraggingSkillFile.value = true
}

function handleSkillDragOver(event: DragEvent) {
  if (!canDropSkillFile(event))
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'copy'
}

function handleSkillDragLeave(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  skillDragDepth = Math.max(0, skillDragDepth - 1)
  if (skillDragDepth === 0)
    isDraggingSkillFile.value = false
}

async function handleSkillDrop(event: DragEvent) {
  if (!canDropSkillFile(event))
    return
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  resetSkillDragState()
  if (file)
    await uploadSkill(file)
}

async function closeDialog() {
  await dialogData.onCancel?.()
  dialogRef?.value.close()
}

function buildMetadata() {
  if (templateType.value === 'prompt')
    return { prompt: prompt.value.trim() }
  if (templateType.value === 'skill') {
    const normalizedPrompt = prompt.value.trim()
    if (isEditing.value)
      return { prompt: normalizedPrompt }

    return {
      ...(sourceValue.value === 'custom' ? customMetadata.value : {}),
      prompt: normalizedPrompt,
    }
  }
  return {
    ...(sourceValue.value === 'custom' ? customMetadata.value : {}),
    params: scriptParams.value,
  }
}

function normalizeScriptParams() {
  const schema = parseScriptParamsSchema(activeMetadata.value.optionsSchema)
  if (!schema)
    return {}
  if (scriptSchemaError.value)
    throw new ScriptParamsFormError(scriptSchemaError.value)
  return buildScriptParams(scriptParamsData.value, scriptParamsErrors.value)
}

async function saveTemplate(saveAndRun: boolean) {
  formError.value = ''
  if (templateType.value === 'script')
    showScriptFormValidation.value = true
  const normalizedName = name.value.trim()
  if (!normalizedName) {
    if (templateType.value !== 'script')
      formError.value = $t('请输入模板名称')
    return
  }
  if (templateType.value === 'prompt' && !prompt.value.trim()) {
    formError.value = $t('请输入提示词内容')
    return
  }
  if (templateType.value !== 'prompt' && !isEditing.value && sourceValue.value == null) {
    if (templateType.value !== 'script')
      formError.value = $t('请选择或上传 Skill')
    return
  }
  if (templateType.value === 'script') {
    showScriptParamsValidation.value = true
    if (scriptParamsErrors.value.length)
      return
    try {
      scriptParams.value = normalizeScriptParams()
    }
    catch (error) {
      formError.value = error instanceof ScriptParamsFormError ? error.message : $t('脚本参数校验失败')
      return
    }
  }

  saving.value = true
  try {
    const shouldClose = await dialogData.onSave?.({
      templateType: templateType.value,
      name: normalizedName,
      description: description.value.trim(),
      metadata: buildMetadata(),
      officialTemplateId: typeof sourceValue.value === 'number' ? sourceValue.value : undefined,
      saveAndRun,
    })
    if (shouldClose !== false)
      dialogRef?.value.close()
  }
  finally {
    saving.value = false
  }
}

watch(sourceValue, applyOfficialSource)
onMounted(() => {
  if (needsDetailLoad && editingTemplate) {
    void loadTemplateDetail(editingTemplate.id)
    if (!dialogData.lockSource)
      void loadOfficialSources(templateType.value)
  }
  else {
    hydrateScriptParamsForm()
    if (!dialogData.lockSource)
      void loadOfficialSources(templateType.value)
  }
})
</script>

<template>
  <div class="agent-console-dialog__shell create-template-dialog" :class="{ 'create-template-dialog--readonly': isReadonly }">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">{{ isReadonly ? $t('查看模板') : isEditing ? $t('编辑模板') : $t('创建模板') }}</h2>
      <button class="agent-console-dialog__close" type="button" :aria-label="$t('关闭模板弹窗')" @click="closeDialog" />
    </header>

    <main class="agent-console-dialog__body create-template-dialog__body">
      <div v-if="loadingDetail" class="create-template-dialog__loading" role="status" aria-busy="true">
        <span class="sr-only">{{ $t('加载中...') }}</span>
        <CreateTemplateFormSkeleton :template-type="templateType" scope="full" />
      </div>

      <div v-else-if="detailError" class="create-template-dialog__state" role="alert">
        <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
        <strong>{{ $t('加载我的模板失败') }}</strong>
        <span>{{ detailError }}</span>
        <button class="create-template-dialog__retry" type="button" @click="retryLoadDetail">
          {{ $t('重试') }}
        </button>
      </div>

      <template v-else>
      <AgentFormField :label="$t('模板名称')">
        <AgentInput v-model="name" type="text" :placeholder="$t('请输入模板名称')" :disabled="isReadonly || saving" />
      </AgentFormField>

      <AgentFormField v-if="!isReadonly" :label="$t('模板内容')">
        <div class="create-template-dialog__types">
          <AgentTooltip
            v-for="card in typeCards"
            :key="card.value"
            :content="card.tooltip"
            :disabled="!card.tooltip || sourceLocked || dialogData.lockKind || saving"
            :show-delay="500"
            placement="top"
            :z-index="1300"
            trigger-class="create-template-dialog__type-tooltip"
          >
            <button
              type="button"
              :class="{ active: templateType === card.value }"
              :disabled="isTypeCardDisabled(card.value)"
              :aria-disabled="isTypeCardDisabled(card.value)"
              :aria-pressed="templateType === card.value"
              @click="selectType(card.value)"
            >
              <span>{{ card.label }}</span>
            </button>
          </AgentTooltip>
        </div>
      </AgentFormField>

      <CreateTemplateFormSkeleton
        v-if="templateType !== 'prompt' && contentPanelLoading"
        :template-type="templateType"
        scope="content"
      />
      <section
        v-else-if="templateType !== 'prompt'"
        class="create-template-dialog__content-panel"
        :class="{ 'is-skill-dragging': isDraggingSkillFile }"
        @dragenter="handleSkillDragEnter"
        @dragleave="handleSkillDragLeave"
        @dragover="handleSkillDragOver"
        @drop="handleSkillDrop"
      >
        <div v-if="isDraggingSkillFile" class="create-template-dialog__skill-drop-prompt" aria-hidden="true">
          <SvgIcon name="extension/rx_ic_upload" size="20" />
          <span>{{ $t('拖拽到此处上传 Skill') }}</span>
          <small>{{ $t('仅支持 .zip 格式的 Skill 包') }}</small>
        </div>

        <AgentFormField :label="templateType === 'script' ? $t('选择脚本') : $t('选择 Skill')">
          <div class="create-template-dialog__source-row">
            <AgentInput v-if="sourceLocked" :model-value="sourceLockedLabel" disabled />
            <AgentSelect
              v-else
              v-model="sourceValue"
              :options="sourceOptions"
              :placeholder="loadingSources ? $t('正在加载官方模板...') : templateType === 'script' ? $t('请选择官方脚本模板') : $t('请选择官方 Skill 模板')"
              :loading="loadingSources"
              :disabled="saving || loadingSources"
            />
            <button
              v-if="!sourceLocked"
              class="create-template-dialog__upload"
              type="button"
              :disabled="saving || uploadingSkill"
              @click="templateType === 'script' ? openScriptUpload() : skillInput?.click()"
            >
              <SvgIcon name="extension/rx_ic_upload" size="16" />
              {{ uploadingSkill ? $t('上传中...') : templateType === 'script' ? $t('上传脚本') : $t('上传 Skill') }}
            </button>
            <input ref="skillInput" type="file" accept=".zip,application/zip" hidden @change="uploadSkillFile">
          </div>
        </AgentFormField>

        <div class="create-template-dialog__details">
          <div class="create-template-dialog__details-title">
            <span>{{ templateType === 'script' ? $t('脚本详情') : $t('Skill 详情') }}</span>
            <small>{{ $t('仅查看') }}</small>
          </div>
          <p>{{ detailDescription || $t('选择来源后展示详情') }}</p>
          <template v-if="templateType === 'skill' && Array.isArray(activeMetadata.files)">
            <div class="create-template-dialog__parameters-title">{{ $t('包含文件') }}</div>
            <p class="create-template-dialog__files">{{ activeMetadata.files.join('、') }}</p>
          </template>
        </div>

        <section
          v-if="templateType === 'script' && (selectedOfficialTemplate || customAsset || isEditing)"
          class="create-template-dialog__script-parameters"
        >
          <div class="create-template-dialog__details-title">
            <span>{{ $t('脚本参数') }}</span>
            <small>{{ $t('根据脚本自动生成') }}</small>
          </div>

          <div v-if="scriptSchema" class="create-template-dialog__script-parameters-fields">
            <ScriptSchemaForm
              :schema="scriptSchema"
              :data="scriptParamsData"
              :locale="localeStore.currentLocale"
              :readonly="isReadonly || saving"
              :show-validation-errors="showScriptParamsValidation"
              @change="updateScriptParamsForm"
              @schema-error="scriptSchemaError = $event"
            />
          </div>
          <p v-else class="create-template-dialog__no-parameters">{{ $t('此脚本无需额外参数') }}</p>
        </section>

        <AgentFormField v-if="templateType === 'skill'">
          <template #label>
            <label class="create-template-dialog__label">
              {{ $t('提示词') }}
              <span>{{ $t('选填，将与此 Skill 一起使用') }}</span>
            </label>
          </template>
          <ChatComposer
            v-model="prompt"
            class="create-template-dialog__textarea"
            variant="prompt-field"
            :placeholder="$t('请输入使用此 Skill 时的提示词')"
            prompt-min-height="76px"
            :pending-attachments="[]"
            :readonly="isReadonly || saving"
            :thinking="false"
          />
        </AgentFormField>
      </section>

      <section v-else class="create-template-dialog__content-panel">
        <AgentFormField :label="$t('提示词内容')">
          <ChatComposer
            v-model="prompt"
            class="create-template-dialog__textarea create-template-dialog__textarea--prompt"
            variant="prompt-field"
            :placeholder="$t('请输入提示词内容')"
            prompt-min-height="176px"
            :pending-attachments="[]"
            :readonly="isReadonly || saving"
            :thinking="false"
          />
        </AgentFormField>
      </section>

      </template>
    </main>

    <p v-if="displayedFormError" class="create-template-dialog__error" role="alert">{{ displayedFormError }}</p>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button" type="button" :disabled="saving" @click="closeDialog">{{ isReadonly ? $t('关闭') : $t('取消') }}</button>
        <button v-if="!isReadonly && !dialogData.submitMode" class="agent-console-dialog__button" type="button" :disabled="saving || !formReady" @click="saveTemplate(false)">
          {{ saving ? $t('保存中...') : $t('仅保存') }}
        </button>
        <button v-if="!isReadonly" class="agent-console-dialog__button primary" type="button" :disabled="saving || !formReady" @click="saveTemplate(dialogData.submitMode === 'run' || !dialogData.submitMode)">
          {{ saving ? $t('保存中...') : dialogData.submitMode === 'save' ? $t('添加模板') : dialogData.submitMode === 'run' ? $t('添加并创建任务') : $t('保存并运行') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.create-template-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-template-dialog--readonly {
  :deep(.agent-input .p-inputtext:disabled) {
    cursor: not-allowed;
  }

  :deep(.script-jsonforms__input:not([type='checkbox'])),
  :deep(.script-jsonforms__select),
  :deep(.script-jsonforms__textarea),
  :deep(.composer) {
    border-color: var(--color-border-primary);
    color: var(--color-text-disabled);
    background: var(--color-bg-primary);
    cursor: not-allowed;
    opacity: 1;
  }

  :deep(.agent-composer-editor),
  :deep(.agent-composer-editor a) {
    color: var(--color-text-disabled) !important;
    cursor: not-allowed !important;
  }

  :deep(.script-jsonforms__input[type='checkbox']) {
    cursor: not-allowed;
  }
}
.create-template-dialog__loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-template-dialog__state {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-text-quaternary);
  text-align: center;

  strong {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  span {
    font-size: 13px;
    line-height: 20px;
  }
}

.create-template-dialog__retry {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
  padding: 5px 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font: inherit;

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.create-template-dialog__types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;

  :deep(.create-template-dialog__type-tooltip) {
    width: 100%;
  }

  button {
    width: 100%;
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

    &:disabled {
      cursor: not-allowed;
      opacity: 1;
    }
  }
}

.create-template-dialog__content-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background: var(--color-bg-tertiary);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;

  &.is-skill-dragging {
    border: 1px dashed var(--color-border-primary-inverse);
    border-radius: 10px;
    color: var(--color-text-primary);
    background: var(--color-bg-quaternary);

    > :not(.create-template-dialog__skill-drop-prompt) {
      opacity: 0;
    }
  }
}

.create-template-dialog__skill-drop-prompt {
  position: absolute;
  z-index: 10;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  border-radius: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-quaternary);
  pointer-events: none;

  small {
    color: var(--color-text-disabled);
    font-size: 12px;
    line-height: 16px;
  }
}

.create-template-dialog__source-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.create-template-dialog__upload {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px dashed var(--color-border-primary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.create-template-dialog__details {
  padding: 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  background: transparent;

  p {
    margin: 6px 0 0;
    color: var(--color-text-tertiary);
    line-height: 20px;
  }
}

.create-template-dialog__details-title {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-primary);
  font-weight: 500;

  small {
    color: var(--color-text-quaternary);
    font-size: 12px;
    font-weight: 400;
  }
}

.create-template-dialog__parameters-title {
  margin-top: 10px;
  color: var(--color-text-quaternary);
  font-size: 12px;
}

.create-template-dialog__script-parameters {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.create-template-dialog__script-parameters-fields {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  margin-top: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 18px;

  span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  button {
    display: inline-flex;
    height: 28px;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    cursor: pointer;
    font: inherit;

    &:hover {
      background: var(--color-bg-quaternary);
    }
  }
}

.create-template-dialog__files {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-template-dialog__label {
  color: var(--color-text-primary);
  font-weight: 500;

  span {
    color: var(--color-text-quaternary);
    font-size: 12px;
    font-weight: 400;
  }
}

.create-template-dialog__textarea {
  min-height: 76px;
}

.create-template-dialog__textarea--prompt {
  min-height: 176px;
}

.create-template-dialog__error {
  flex: none;
  margin: 0;
  padding: 0 20px;
  color: var(--color-text-error-primary);
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .create-template-dialog__types {
    grid-template-columns: 1fr;
  }

  .create-template-dialog__source-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .create-template-dialog__error {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
