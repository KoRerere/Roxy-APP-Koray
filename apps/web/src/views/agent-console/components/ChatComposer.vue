<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import type { AgentAttachment, AgentFolderSelection, AgentHitlChoiceControl, AgentHitlChoiceOption, AgentHitlControlValue, AgentHitlRequest, AgentHitlSubmitPayload, AgentHitlTextControl, AgentPathSelection, AgentQueuedPrompt, AgentTodoProgress } from '../types'
import type { AgentComposerItem } from './chat-composer/types'
import type { ClipboardFileSource } from './chat-composer/clipboardFiles'
import AgentTooltip from './AgentTooltip.vue'
import ComposerToolbar from './ComposerToolbar.vue'
import PromptQueue from './PromptQueue.vue'
import SuggestionMenu from './chat-composer/SuggestionMenu.vue'
import { createClipboardPathAttachment, getClipboardFileSources, splitClipboardFilesByLocalPath } from './chat-composer/clipboardFiles'
import { shouldConvertPastedTextToFile } from './chat-composer/pasteText'
import {
  getInvalidTemplateReferenceLabels,
  getMissingComposerTokenLabels,
  splitUrlValue,
} from './chat-composer/protocol'
import { useAgentComposer } from './chat-composer/useAgentComposer'
import { observeUrlFavicons } from '../utils/urlFavicon'
import { applyClarificationOptionSelection, collectStructuredClarificationAnswers } from '../clarificationAnswerState'

const props = defineProps<{
  autoFocus?: boolean
  contentKey?: number | string
  focusKey?: number | string
  hitlRequest?: AgentHitlRequest
  pendingAttachments: AgentAttachment[]
  queuedPrompts?: AgentQueuedPrompt[]
  placeholder?: string
  promptMinHeight?: string
  readonly?: boolean
  recommendedTemplateItems?: AgentComposerItem[]
  thinking: boolean
  showGlow?: boolean
  todoProgress?: AgentTodoProgress
  variant?: 'chat' | 'prompt-field'
}>()

const emit = defineEmits<{
  addAttachments: [files: File[]]
  addFolder: [folder: AgentFolderSelection]
  addPathAttachment: [selection: AgentPathSelection]
  removeAttachment: [fileId: string]
  removeQueuedPrompt: [promptId: string]
  reorderQueuedPrompt: [payload: { promptId: string, targetIndex: number }]
  restoreQueuedPrompt: [promptId: string]
  send: []
  stop: []
  submitHitl: [payload: AgentHitlSubmitPayload]
  officialTemplateTopChanged: []
}>()

const model = defineModel<string>({ required: true })
const recommendedTemplateItems = computed(() => props.recommendedTemplateItems ?? [])
const isPromptField = computed(() => props.variant === 'prompt-field')
const isEditable = computed(() => !props.readonly)
const composerPlaceholder = computed(() => props.placeholder ?? '')
const composerStyle = computed(() => isPromptField.value && props.promptMinHeight
  ? { '--agent-prompt-field-min-height': props.promptMinHeight }
  : undefined)

const shellRef = ref<HTMLElement | null>(null)
const composerShellRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const inputTokenInputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const inputTokenPopoverRef = ref<HTMLElement | null>(null)
const inputTokenActionsRef = ref<HTMLElement | null>(null)
const hitlValues = ref<Record<string, AgentHitlControlValue>>({})
const inputTokenValue = ref('')
const inputUrlProtocol = ref<'http://' | 'https://'>('https://')
const inputTokenComposing = ref(false)
const inputTokenTextareaMultiline = ref(false)
const inputTokenTextareaManuallyResized = ref(false)
const missingPromptWarning = ref('')
const inputTokenPopoverStyle = reactive({
  left: '0px',
  top: '0px',
  transform: 'translate(-50%, -100%)',
  maxWidth: '460px',
  zIndex: '80',
})
const inputTokenPopoverPlacement = ref<'top' | 'bottom'>('top')
const pastedTextFileIndex = ref(0)
const clarificationDescriptionOverflow = ref<Record<string, boolean>>({})
const clarificationQuestionIndex = ref(0)
const clarificationSelections = ref<Record<string, string>>({})

interface ClarificationDisplayOption extends AgentHitlChoiceOption {
  description?: string
}
const INPUT_TOKEN_TEXTAREA_MIN_HEIGHT = 30
const INPUT_TOKEN_TEXTAREA_MULTILINE_HEIGHT = 52

const {
  allMentionItemsSelected,
  cancelMentionSelection,
  canSubmit,
  chooseItem,
  closeSuggestion,
  cancelInputTokenEdit,
  editor,
  focusEditor,
  confirmMentionSelection,
  confirmInputTokenEdit,
  inputEditor,
  isEmpty,
  markSuggestionItemRead,
  toggleSuggestionItemTop,
  navigateSuggestion,
  profileHasMore,
  profileLoadError,
  profileLoadingMore,
  profileReloading,
  profileSelectingAll,
  projectOptions,
  loadMoreProfiles,
  selectedMentionCount,
  selectedMentionIds,
  selectedProjectId,
  retryLoadProfiles,
  selectToolbar,
  suggestion,
  toggleAllMentionItems,
  updateSelectedProject,
  updateSuggestionQuery,
} = useAgentComposer({
  model,
  editable: isEditable,
  contentKey: computed(() => props.contentKey),
  onSend: handleComposerSend,
  onOfficialTemplateTopChanged: () => emit('officialTemplateTopChanged'),
  recommendedSlashItems: recommendedTemplateItems,
  submitOnEnter: !isPromptField.value,
})

const hasAttachmentUploading = computed(() => props.pendingAttachments.some(attachment => attachment.uploadStatus === 'uploading'))
const composerCanSubmit = computed(() => {
  return canSubmit.value || props.pendingAttachments.length > 0
})
const hasPromptContent = computed(() => Boolean(model.value.trim()))
const hasComposerPayload = computed(() => hasPromptContent.value || props.pendingAttachments.length > 0)
const showStopButton = computed(() => props.thinking && !hasComposerPayload.value)
let autoFocusFrame = 0
let inputTokenPopoverFrame = 0
let inputTokenActionsAnimationFrame = 0
let inputTokenGlobalListenersBound = false
let inputTokenPopoverResizeObserver: ResizeObserver | undefined
let stopInputTokenTextareaResize: (() => void) | undefined
let clarificationDescriptionFrame = 0
let clarificationDescriptionResizeObserver: ResizeObserver | undefined
const clarificationDescriptionEls = new Map<string, HTMLElement>()
let stopObservingUrlFavicons = () => {}

function requestEditorFocus() {
  if (!props.autoFocus || props.hitlRequest) {
    return
  }

  if (typeof window === 'undefined') {
    focusEditor()
    return
  }

  if (autoFocusFrame) {
    window.cancelAnimationFrame(autoFocusFrame)
  }

  autoFocusFrame = window.requestAnimationFrame(() => {
    autoFocusFrame = 0
    focusEditor()
  })
}

function getFileExtension(fileName: string) {
  const ext = fileName.split('.').pop()
  return ext && ext !== fileName ? ext.toUpperCase() : $t('文件')
}

function getAttachmentPreview(attachment: AgentAttachment) {
  return attachment.preview || attachment.url || attachment.localUrl || attachment.fileUrl || attachment.remoteUrl || ''
}

function isImageFileName(fileName: string) {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(fileName)
}

function isImageAttachment(attachment: AgentAttachment) {
  return attachment.kind === 'file'
    && (attachment.mimeType.startsWith('image/') || isImageFileName(attachment.fileName))
    && Boolean(getAttachmentPreview(attachment))
}

function getAttachmentTypeLabel(attachment: AgentAttachment) {
  if (attachment.uploadStatus === 'uploading') {
    return $t('上传中')
  }

  if (attachment.uploadStatus === 'error') {
    return $t('上传失败')
  }

  if (attachment.kind === 'folder') {
    return 'Folder'
  }

  return getFileExtension(attachment.fileName)
}

function getPathBaseName(value: string) {
  return value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value
}

function getFolderNameFromFiles(files: File[]) {
  const first = files[0] as (File & { webkitRelativePath?: string }) | undefined
  const relativePath = first?.webkitRelativePath
  return relativePath?.split('/').filter(Boolean)[0] || first?.name || $t('文件夹')
}

async function openAttachmentPicker() {
  if (globalThis.isElectron) {
    try {
      const selected = await globalThis.electronAPI.send('dialog:selectFileOrDirInfo')
      if (selected?.path) {
        emit('addPathAttachment', {
          kind: selected.type === 'dir' ? 'folder' : 'file',
          name: selected.name || getPathBaseName(selected.path),
          path: selected.path,
        })
      }
      return
    }
    catch (error) {
      console.error('[agent-console] Failed to select attachment:', error)
    }
  }

  fileInputRef.value?.click()
}

function addFiles(files: File[]) {
  if (!files.length || props.thinking) {
    return
  }

  emit('addAttachments', files)
}

function getPastedFileLocalPath(file: File) {
  if (!globalThis.isElectron) {
    return ''
  }

  try {
    return globalThis.electronAPI.getPathForFile(file) || ''
  }
  catch (error) {
    console.error('[agent-console] Failed to get pasted file path:', error)
    return ''
  }
}

function addPastedFiles(sources: ClipboardFileSource[]) {
  if (!sources.length) {
    return
  }

  const files = sources.map(source => source.file)
  if (!globalThis.isElectron) {
    emit('addAttachments', files)
    return
  }

  const { localPathFiles, uploadFiles } = splitClipboardFilesByLocalPath(
    files,
    getPastedFileLocalPath,
  )
  const entryByFile = new Map(sources.map(source => [source.file, source.entry]))

  const pathAttachments = localPathFiles.map(({ file, path }) => {
    const entry = entryByFile.get(file) ?? null
    return createClipboardPathAttachment(file.name, path, entry)
  })

  for (const attachment of pathAttachments) {
    emit('addPathAttachment', attachment)
  }

  if (uploadFiles.length) {
    emit('addAttachments', uploadFiles)
  }
}

function createPastedTextFile(text: string) {
  pastedTextFileIndex.value += 1
  const suffix = pastedTextFileIndex.value === 1 ? '' : `-${pastedTextFileIndex.value}`
  return new File([text], `pasted-text${suffix}.txt`, {
    lastModified: Date.now(),
    type: 'text/plain',
  })
}

function handleComposerPaste(event: ClipboardEvent) {
  const sources = getClipboardFileSources(event.clipboardData)
  if (isPromptField.value || props.readonly) {
    return
  }

  if (sources.length) {
    event.preventDefault()
    event.stopPropagation()
    addPastedFiles(sources)
    return
  }

  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!shouldConvertPastedTextToFile(text)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  addFiles([createPastedTextFile(text)])
}

function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  addFiles(Array.from(input?.files ?? []))
  if (input) {
    input.value = ''
  }
}

function handleFolderInputChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  if (files.length > 0) {
    emit('addFolder', { name: getFolderNameFromFiles(files), files })
  }
  if (input) {
    input.value = ''
  }
}

function setActiveSuggestion(item: AgentComposerItem) {
  const index = suggestion.items.findIndex(candidate => candidate.id === item.id)

  if (index >= 0) {
    suggestion.activeIndex = index
  }
}

function handleSendButtonClick() {
  if (showStopButton.value) {
    emit('stop')
    return
  }

  if (!composerCanSubmit.value) {
    return
  }

  handleComposerSend()
}

function handleComposerSend() {
  if (!composerCanSubmit.value) {
    return
  }

  const missingLabels = getMissingComposerTokenLabels(model.value)
  if (missingLabels.length) {
    missingPromptWarning.value = $t('请补充：{items}', { items: missingLabels.join('、') })
    focusEditor()
    return
  }

  if (getInvalidTemplateReferenceLabels(model.value).length) {
    missingPromptWarning.value = $t('模板引用无效，请重新选择模板')
    focusEditor()
    return
  }

  missingPromptWarning.value = ''
  emit('send')
}

function handleRestoreQueuedPrompt(promptId: string) {
  emit('restoreQueuedPrompt', promptId)
  nextTick(focusEditor)
}

function submitInputTokenEdit() {
  inputTokenComposing.value = false
  let value = inputTokenValue.value
  if (inputEditor.kind === 'url' && value.trim()) {
    const hasExplicitProtocol = /^https?:\/\//i.test(value.trim())
    const parts = splitUrlValue(value)
    value = `${hasExplicitProtocol ? parts.protocol : inputUrlProtocol.value}${parts.value}`
  }
  confirmInputTokenEdit(value)
  missingPromptWarning.value = ''
}

function handleUrlTokenPaste(event: ClipboardEvent) {
  const pastedValue = event.clipboardData?.getData('text/plain')?.trim()
  if (!pastedValue) {
    return
  }

  const parts = splitUrlValue(pastedValue)
  inputUrlProtocol.value = parts.protocol
  inputTokenValue.value = parts.value
  event.preventDefault()
}

function handleInputTokenKeydown(event: KeyboardEvent) {
  event.stopPropagation()

  if (inputTokenComposing.value || event.isComposing || event.keyCode === 229) {
    return
  }

  if (event.key === 'Enter') {
    if (inputEditor.kind === 'textarea') {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault()
        submitInputTokenEdit()
      }
      return
    }

    event.preventDefault()
    submitInputTokenEdit()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelInputTokenEdit()
  }
}

function scheduleInputTokenPopoverSync() {
  if (!inputEditor.open || !inputEditor.anchorEl) {
    return
  }

  if (inputTokenPopoverFrame) {
    window.cancelAnimationFrame(inputTokenPopoverFrame)
  }

  inputTokenPopoverFrame = window.requestAnimationFrame(() => {
    inputTokenPopoverFrame = 0
    syncInputTokenPopoverPosition()
  })
}

function syncInputTokenTextareaHeight() {
  if (inputEditor.kind !== 'textarea') {
    inputTokenTextareaMultiline.value = false
    inputTokenTextareaManuallyResized.value = false
    return
  }

  const inputEl = inputTokenInputRef.value
  if (!(inputEl instanceof HTMLTextAreaElement)) 
    return

  if (inputTokenTextareaManuallyResized.value) {
    inputEl.style.overflowY = 'auto'
    scheduleInputTokenPopoverSync()
    return
  }

  if (inputTokenTextareaMultiline.value) {
    inputEl.style.height = `${INPUT_TOKEN_TEXTAREA_MULTILINE_HEIGHT}px`
    inputEl.style.overflowY = 'auto'
    scheduleInputTokenPopoverSync()
    return
  }

  const previousActionsRect = inputTokenActionsRef.value?.getBoundingClientRect()
  inputEl.style.height = `${INPUT_TOKEN_TEXTAREA_MIN_HEIGHT}px`
  const hasMultilineContent = inputEl.scrollHeight > INPUT_TOKEN_TEXTAREA_MIN_HEIGHT + 2
  if (hasMultilineContent) {
    inputTokenTextareaMultiline.value = true
    inputEl.style.height = `${INPUT_TOKEN_TEXTAREA_MULTILINE_HEIGHT}px`
    inputEl.style.overflowY = 'auto'
  }
  else {
    inputEl.style.overflowY = 'hidden'
  }
  scheduleInputTokenPopoverSync()

  if (hasMultilineContent && previousActionsRect) {
    void nextTick(() => {
      if (inputTokenTextareaMultiline.value !== hasMultilineContent) {
        return
      }

      syncInputTokenPopoverPosition()
      const nextActionsRect = inputTokenActionsRef.value?.getBoundingClientRect()
      if (nextActionsRect) {
        runInputTokenActionsMoveAnimation(previousActionsRect, nextActionsRect)
      }
    })
  }
}

function handleInputTokenTextareaResizeStart(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const inputEl = inputTokenInputRef.value
  if (!(inputEl instanceof HTMLTextAreaElement)) {
    return
  }

  event.preventDefault()
  stopInputTokenTextareaResize?.()
  inputEl.focus()

  if (inputTokenActionsAnimationFrame) {
    window.cancelAnimationFrame(inputTokenActionsAnimationFrame)
    inputTokenActionsAnimationFrame = 0
  }
  inputTokenActionsRef.value?.classList.remove('input-token-popover__actions--moving')

  const pointerId = event.pointerId
  const startY = event.clientY
  const startHeight = inputEl.getBoundingClientRect().height
  const maxHeight = Math.max(
    INPUT_TOKEN_TEXTAREA_MIN_HEIGHT,
    Math.min(window.innerHeight * 0.4, 320),
  )
  const previousUserSelect = document.body.style.userSelect

  document.body.style.userSelect = 'none'

  const handlePointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return
    }

    const nextHeight = Math.min(
      maxHeight,
      Math.max(
        INPUT_TOKEN_TEXTAREA_MIN_HEIGHT,
        startHeight + startY - moveEvent.clientY,
      ),
    )
    const nextMultiline = nextHeight > INPUT_TOKEN_TEXTAREA_MIN_HEIGHT

    inputTokenTextareaManuallyResized.value = true
    inputEl.style.height = `${nextHeight}px`
    inputTokenTextareaMultiline.value = nextMultiline
    scheduleInputTokenPopoverSync()
  }
  const stopResize = (endEvent?: PointerEvent) => {
    if (endEvent && endEvent.pointerId !== pointerId) {
      return
    }

    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
    document.body.style.userSelect = previousUserSelect
    stopInputTokenTextareaResize = undefined
  }

  stopInputTokenTextareaResize = stopResize
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

function runInputTokenActionsMoveAnimation(previousRect: DOMRect, nextRect: DOMRect) {
  const actionsEl = inputTokenActionsRef.value
  if (!actionsEl)
    return

  const deltaX = previousRect.left - nextRect.left
  const deltaY = previousRect.top - nextRect.top
  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1)
    return

  if (inputTokenActionsAnimationFrame)
    window.cancelAnimationFrame(inputTokenActionsAnimationFrame)

  actionsEl.classList.remove('input-token-popover__actions--moving')
  actionsEl.style.setProperty('--input-token-actions-from-x', `${deltaX}px`)
  actionsEl.style.setProperty('--input-token-actions-from-y', `${deltaY}px`)

  inputTokenActionsAnimationFrame = window.requestAnimationFrame(() => {
    inputTokenActionsAnimationFrame = 0
    actionsEl.classList.add('input-token-popover__actions--moving')
  })
}

function getInputTokenPopoverZIndex(anchorEl: HTMLElement) {
  let highestAncestorZIndex = 80
  let current: HTMLElement | null = anchorEl

  while (current) {
    const zIndex = Number.parseInt(window.getComputedStyle(current).zIndex, 10)
    if (Number.isFinite(zIndex)) {
      highestAncestorZIndex = Math.max(highestAncestorZIndex, zIndex)
    }

    if (current === document.body) {
      break
    }

    current = current.parentElement
  }

  return highestAncestorZIndex + 1
}

function syncInputTokenPopoverPosition() {
  const anchorEl = inputEditor.anchorEl
  if (!inputEditor.open || !anchorEl) {
    return
  }

  const anchorRect = anchorEl.getBoundingClientRect()
  const popoverEl = inputTokenPopoverRef.value
  const popoverWidth = popoverEl?.offsetWidth || 360
  const popoverHeight = popoverEl?.offsetHeight || 120
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const topSpace = anchorRect.top
  const bottomSpace = viewportHeight - anchorRect.bottom
  const placement = topSpace >= popoverHeight + 16 || topSpace >= bottomSpace ? 'top' : 'bottom'
  const left = Math.min(
    Math.max(anchorRect.left + anchorRect.width / 2, popoverWidth / 2 + 12),
    viewportWidth - popoverWidth / 2 - 12,
  )
  const top = placement === 'top'
    ? anchorRect.top - 8
    : anchorRect.bottom + 8

  inputTokenPopoverStyle.left = `${left}px`
  inputTokenPopoverStyle.top = `${top}px`
  inputTokenPopoverStyle.transform = placement === 'top'
    ? 'translate(-50%, -100%)'
    : 'translate(-50%, 0)'
  inputTokenPopoverStyle.maxWidth = `${Math.min(460, viewportWidth - 24)}px`
  inputTokenPopoverStyle.zIndex = String(getInputTokenPopoverZIndex(anchorEl))
  inputTokenPopoverPlacement.value = placement
}

function onInputTokenDocumentPointerDown(event: PointerEvent) {
  if (!inputEditor.open) {
    return
  }

  const path = event.composedPath()
  if (inputTokenPopoverRef.value && path.includes(inputTokenPopoverRef.value)) {
    return
  }

  if (inputEditor.anchorEl && path.includes(inputEditor.anchorEl)) {
    return
  }

  cancelInputTokenEdit()
}

function onInputTokenDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    cancelInputTokenEdit()
  }
}

function bindInputTokenGlobalListeners() {
  if (inputTokenGlobalListenersBound || typeof window === 'undefined') {
    return
  }

  inputTokenGlobalListenersBound = true
  document.addEventListener('pointerdown', onInputTokenDocumentPointerDown, true)
  document.addEventListener('keydown', onInputTokenDocumentKeydown)
  window.addEventListener('resize', scheduleInputTokenPopoverSync)
  window.addEventListener('scroll', scheduleInputTokenPopoverSync, true)
}

function unbindInputTokenGlobalListeners() {
  if (!inputTokenGlobalListenersBound || typeof window === 'undefined') {
    return
  }

  inputTokenGlobalListenersBound = false
  document.removeEventListener('pointerdown', onInputTokenDocumentPointerDown, true)
  document.removeEventListener('keydown', onInputTokenDocumentKeydown)
  window.removeEventListener('resize', scheduleInputTokenPopoverSync)
  window.removeEventListener('scroll', scheduleInputTokenPopoverSync, true)
}

function dismissSuggestionMenu() {
  if (!suggestion.open) {
    return
  }

  if (suggestion.kind === 'mention') {
    cancelMentionSelection()
    return
  }

  closeSuggestion()
}

function handleToolbarSelect(trigger: 'attach' | '@' | '/') {
  if (trigger === 'attach') {
    dismissSuggestionMenu()
    void openAttachmentPicker()
    return
  }

  const kind = trigger === '@' ? 'mention' : 'slash'
  if (suggestion.open && suggestion.kind === kind) {
    dismissSuggestionMenu()
    return
  }

  void selectToolbar(trigger)
}

const hitlChoiceControls = computed<AgentHitlChoiceControl[]>(() => {
  return props.hitlRequest?.controls.filter((control): control is AgentHitlChoiceControl => control.kind === 'choice') ?? []
})

const hitlInputControls = computed<AgentHitlTextControl[]>(() => {
  return props.hitlRequest?.controls.filter((control): control is AgentHitlTextControl => control.kind === 'text' || control.kind === 'textarea') ?? []
})

const isHitlSubmitting = computed(() => props.hitlRequest?.status === 'submitting')
const isClarificationHitl = computed(() => {
  const payload = props.hitlRequest?.source?.payload
  return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as Record<string, unknown>).requestKind === 'clarification')
})
const clarificationQuestions = computed(() => {
  return isClarificationHitl.value ? props.hitlRequest?.clarificationQuestions ?? [] : []
})
const hasStructuredClarificationQuestions = computed(() => clarificationQuestions.value.length > 0)
const activeClarificationQuestion = computed(() => {
  return clarificationQuestions.value[clarificationQuestionIndex.value]
})
const clarificationChoiceControl = computed(() => {
  if (!isClarificationHitl.value || hasStructuredClarificationQuestions.value) {
    return undefined
  }

  return hitlChoiceControls.value.find(control => control.id === 'answer') ?? hitlChoiceControls.value[0]
})
const clarificationSubmitControl = computed(() => {
  if (!isClarificationHitl.value) {
    return undefined
  }

  return hitlChoiceControls.value.find(control => control.id === 'submit')
})
const clarificationTextControl = computed(() => {
  if (!isClarificationHitl.value || hasStructuredClarificationQuestions.value) {
    return undefined
  }

  return hitlInputControls.value.find(control => control.id === 'answer') ?? hitlInputControls.value[0]
})
const clarificationAnswerControlId = computed(() => {
  if (activeClarificationQuestion.value) {
    return `answer:${activeClarificationQuestion.value.id}`
  }
  return clarificationTextControl.value?.id ?? clarificationChoiceControl.value?.id ?? 'answer'
})
const clarificationOptions = computed<ClarificationDisplayOption[]>(() => {
  const question = activeClarificationQuestion.value
  if (question) {
    return question.options.map((option, index) => ({
      id: `${question.id}-option-${index + 1}`,
      label: option.label,
      value: option.label,
      description: option.description,
    }))
  }

  return clarificationChoiceControl.value?.options ?? []
})
const shouldRenderClarificationEditor = computed(() => Boolean(isClarificationHitl.value && props.hitlRequest))
const nonClarificationChoiceControls = computed(() => {
  return isClarificationHitl.value ? [] : hitlChoiceControls.value
})
const nonClarificationInputControls = computed(() => {
  return isClarificationHitl.value ? [] : hitlInputControls.value
})
const clarificationInputPlaceholder = computed(() => {
  if (activeClarificationQuestion.value) {
    return $t('输入你的回答，也可以先选择上方建议')
  }
  return clarificationTextControl.value?.placeholder ?? $t('输入你的回答，也可以先选择上方建议')
})
const displayedHitlPrompt = computed(() => activeClarificationQuestion.value?.question ?? props.hitlRequest?.prompt ?? '')
const canSubmitClarification = computed(() => {
  if (!props.hitlRequest || isHitlSubmitting.value) {
    return false
  }

  const value = getHitlInputValue(clarificationAnswerControlId.value).trim()
  if (hasStructuredClarificationQuestions.value) {
    return true
  }

  const required = clarificationTextControl.value?.required ?? clarificationChoiceControl.value?.required ?? true
  return !required || Boolean(value)
})

function getHitlInputValue(controlId: string) {
  const value = hitlValues.value[controlId]
  return value === undefined || value === null ? '' : String(value)
}

function setHitlInputValue(controlId: string, value: string) {
  hitlValues.value = {
    ...hitlValues.value,
    [controlId]: value,
  }
}

function handleHitlInput(controlId: string, event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    setHitlInputValue(controlId, target.value)
  }
}

function submitHitlChoice(control: AgentHitlChoiceControl, value: AgentHitlControlValue) {
  const request = props.hitlRequest
  if (!request || isHitlSubmitting.value) {
    return
  }

  emit('submitHitl', {
    requestId: request.id,
    values: {
      ...hitlValues.value,
      [control.id]: value,
    },
    fullAccess: control.id === 'approval'
      && control.options.find(option => option.value === value)?.id === 'full-access',
  })
}

function hitlValueToEditableText(value: AgentHitlControlValue, fallback = '') {
  return value === undefined || value === null ? fallback : String(value)
}

function clarificationAnswers(): Record<string, string> {
  return collectStructuredClarificationAnswers({
    questions: clarificationQuestions.value,
    hitlValues: hitlValues.value,
    selections: clarificationSelections.value,
  })
}

function submitStructuredClarification() {
  const request = props.hitlRequest
  if (!request || isHitlSubmitting.value) {
    return
  }

  emit('submitHitl', {
    requestId: request.id,
    values: {
      ...hitlValues.value,
      answer: JSON.stringify(clarificationAnswers()),
    },
  })
}

function previousClarificationQuestion() {
  clarificationQuestionIndex.value = Math.max(0, clarificationQuestionIndex.value - 1)
}

function nextClarificationQuestion() {
  if (clarificationQuestionIndex.value >= clarificationQuestions.value.length - 1) {
    submitStructuredClarification()
    return
  }

  clarificationQuestionIndex.value += 1
}

function chooseClarificationOption(option: ClarificationDisplayOption) {
  const question = activeClarificationQuestion.value
  if (question) {
    const nextState = applyClarificationOptionSelection({
      hitlValues: hitlValues.value,
      selections: clarificationSelections.value,
      questionId: question.id,
      answer: hitlValueToEditableText(option.value, option.label),
    })
    hitlValues.value = nextState.hitlValues
    clarificationSelections.value = nextState.selections
    nextClarificationQuestion()
    return
  }

  const control = clarificationChoiceControl.value
  if (!control || isHitlSubmitting.value) {
    return
  }

  submitClarificationAnswer(hitlValueToEditableText(option.value, option.label))
}

function submitClarificationAnswer(answerOverride?: string) {
  const request = props.hitlRequest
  if (!request || isHitlSubmitting.value) {
    return
  }

  const answerControlId = clarificationAnswerControlId.value
  const answer = (answerOverride ?? getHitlInputValue(answerControlId)).trim()
  if (activeClarificationQuestion.value) {
    setHitlInputValue(answerControlId, answer)
    nextClarificationQuestion()
    return
  }

  if (!answer && !canSubmitClarification.value) {
    return
  }

  const values: Record<string, AgentHitlControlValue> = {
    ...hitlValues.value,
    answer,
    [answerControlId]: answer,
  }

  if (clarificationSubmitControl.value) {
    values[clarificationSubmitControl.value.id] = clarificationSubmitControl.value.options[0]?.value ?? true
  }

  emit('submitHitl', {
    requestId: request.id,
    values,
  })
}

function submitClarificationSkip() {
  const request = props.hitlRequest
  if (!request || isHitlSubmitting.value) {
    return
  }

  const answerControlId = clarificationAnswerControlId.value
  const question = activeClarificationQuestion.value
  if (question) {
    setHitlInputValue(answerControlId, '')
    const { [question.id]: _removed, ...rest } = clarificationSelections.value
    clarificationSelections.value = rest
    nextClarificationQuestion()
    return
  }

  const values: Record<string, AgentHitlControlValue> = {
    ...hitlValues.value,
    answer: '',
    [answerControlId]: '',
  }

  if (clarificationSubmitControl.value) {
    values[clarificationSubmitControl.value.id] = clarificationSubmitControl.value.options[0]?.value ?? true
  }

  emit('submitHitl', {
    requestId: request.id,
    values,
  })
}

function handleClarificationKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return
  }

  event.preventDefault()
  submitClarificationAnswer()
}

function getClarificationOptionTitle(option: ClarificationDisplayOption) {
  return splitClarificationOptionLabel(option.label).title
}

function getClarificationOptionDescription(option: ClarificationDisplayOption) {
  return option.description ?? splitClarificationOptionLabel(option.label).description
}

function isClarificationOptionSelected(option: ClarificationDisplayOption) {
  const question = activeClarificationQuestion.value
  return Boolean(question && clarificationSelections.value[question.id] === hitlValueToEditableText(option.value, option.label).trim())
}

function isClarificationDescriptionOverflowing(optionId: string) {
  return Boolean(clarificationDescriptionOverflow.value[optionId])
}

function scheduleClarificationDescriptionMeasure() {
  if (typeof window === 'undefined') {
    return
  }

  if (clarificationDescriptionFrame) {
    window.cancelAnimationFrame(clarificationDescriptionFrame)
  }

  clarificationDescriptionFrame = window.requestAnimationFrame(() => {
    clarificationDescriptionFrame = 0
    measureClarificationDescriptionOverflow()
  })
}

function getClarificationDescriptionResizeObserver() {
  if (!clarificationDescriptionResizeObserver) {
    clarificationDescriptionResizeObserver = new ResizeObserver(() => {
      scheduleClarificationDescriptionMeasure()
    })
  }

  return clarificationDescriptionResizeObserver
}

function setClarificationDescriptionRef(optionId: string, el: Element | ComponentPublicInstance | null) {
  const nextEl = el instanceof HTMLElement ? el : null
  const previousEl = clarificationDescriptionEls.get(optionId)

  if (previousEl === nextEl) {
    return
  }

  if (previousEl) {
    clarificationDescriptionResizeObserver?.unobserve(previousEl)
  }

  if (!nextEl) {
    clarificationDescriptionEls.delete(optionId)
    const { [optionId]: _removed, ...rest } = clarificationDescriptionOverflow.value
    clarificationDescriptionOverflow.value = rest
    return
  }

  clarificationDescriptionEls.set(optionId, nextEl)
  getClarificationDescriptionResizeObserver().observe(nextEl)
  scheduleClarificationDescriptionMeasure()
}

function measureClarificationDescriptionOverflow() {
  const nextOverflow: Record<string, boolean> = {}

  clarificationDescriptionEls.forEach((el, optionId) => {
    nextOverflow[optionId] = el.scrollWidth > el.clientWidth + 1
  })

  clarificationDescriptionOverflow.value = nextOverflow
}

function splitClarificationOptionLabel(label: string) {
  const [title, ...descriptionParts] = label.split(/[:：]/)
  const description = descriptionParts.join('：').trim()
  if (!description) {
    return {
      title: label,
      description: '',
    }
  }

  return {
    title: title.trim(),
    description,
  }
}

watch(() => props.hitlRequest?.id, () => {
  const values: Record<string, AgentHitlControlValue> = {
    ...(props.hitlRequest?.values ?? {}),
  }

  for (const control of props.hitlRequest?.controls ?? []) {
    if ((control.kind === 'text' || control.kind === 'textarea') && values[control.id] === undefined) {
      values[control.id] = control.defaultValue ?? ''
    }
  }

  hitlValues.value = values
  clarificationQuestionIndex.value = 0
  clarificationSelections.value = {}
  clarificationDescriptionOverflow.value = {}
  void nextTick(scheduleClarificationDescriptionMeasure)
}, { immediate: true })

watch(() => clarificationOptions.value.map(option => option.label).join('\n'), () => {
  void nextTick(scheduleClarificationDescriptionMeasure)
}, { flush: 'post' })

watch(
  () => [props.autoFocus, props.focusKey, props.hitlRequest?.id, editor.value] as const,
  async ([autoFocus, _focusKey, hitlRequestId]) => {
    if (!autoFocus || hitlRequestId || !editor.value) {
      return
    }

    await nextTick()
    requestEditorFocus()
  },
  { flush: 'post', immediate: true },
)

watch(
  () => [inputEditor.open, inputEditor.label, inputEditor.value, inputEditor.kind] as const,
  async ([open, _label, value]) => {
    if (!open) {
      inputTokenComposing.value = false
      inputTokenTextareaMultiline.value = false
      inputTokenTextareaManuallyResized.value = false
      stopInputTokenTextareaResize?.()
      unbindInputTokenGlobalListeners()
      inputTokenPopoverResizeObserver?.disconnect()
      inputTokenPopoverResizeObserver = undefined
      return
    }

    inputTokenComposing.value = false
    inputTokenTextareaMultiline.value = inputEditor.kind === 'textarea'
    inputTokenTextareaManuallyResized.value = false
    if (inputEditor.kind === 'url') {
      const parts = splitUrlValue(value)
      inputUrlProtocol.value = parts.protocol
      inputTokenValue.value = parts.value
    }
    else {
      inputTokenValue.value = value
    }
    bindInputTokenGlobalListeners()
    await nextTick()
    if (typeof ResizeObserver !== 'undefined' && inputTokenPopoverRef.value) {
      inputTokenPopoverResizeObserver?.disconnect()
      inputTokenPopoverResizeObserver = new ResizeObserver(() => scheduleInputTokenPopoverSync())
      inputTokenPopoverResizeObserver.observe(inputTokenPopoverRef.value)
    }
    inputTokenInputRef.value?.focus()
    inputTokenInputRef.value?.select()
    syncInputTokenTextareaHeight()
    scheduleInputTokenPopoverSync()
  },
)
watch(inputTokenValue, async () => {
  if (!inputEditor.open || inputEditor.kind !== 'textarea')
    return

  await nextTick()
  syncInputTokenTextareaHeight()
})

watch(model, (value) => {
  if (!missingPromptWarning.value) {
    return
  }

  if (!getMissingComposerTokenLabels(value).length) {
    missingPromptWarning.value = ''
  }
})

onMounted(() => {
  stopObservingUrlFavicons = observeUrlFavicons(composerShellRef.value)
})

onBeforeUnmount(() => {
  if (autoFocusFrame) {
    window.cancelAnimationFrame(autoFocusFrame)
  }

  if (inputTokenPopoverFrame) {
    window.cancelAnimationFrame(inputTokenPopoverFrame)
  }

  if (clarificationDescriptionFrame) {
    window.cancelAnimationFrame(clarificationDescriptionFrame)
  }

  if (inputTokenActionsAnimationFrame)
    window.cancelAnimationFrame(inputTokenActionsAnimationFrame)

  unbindInputTokenGlobalListeners()
  stopInputTokenTextareaResize?.()
  inputTokenPopoverResizeObserver?.disconnect()
  clarificationDescriptionResizeObserver?.disconnect()
  stopObservingUrlFavicons()
})

defineExpose({
  getComposerElement: () => composerShellRef.value,
  getEmptyInputTokenElement: () => composerShellRef.value?.querySelector<HTMLElement>(
    '[data-agent-token="input"].agent-token--input-empty, [data-agent-token="textarea"].agent-token--input-empty',
  ) ?? null,
  getEmptyProfileTokenElement: () => composerShellRef.value?.querySelector<HTMLElement>(
    '[data-agent-token="profile"].agent-token--profile-empty',
  ) ?? null,
  getSelectWindowButtonElement: () => composerShellRef.value?.querySelector<HTMLElement>(
    '[data-agent-select-window]',
  ) ?? null,
  getSelectTemplateButtonElement: () => composerShellRef.value?.querySelector<HTMLElement>(
    '[data-agent-select-template]',
  ) ?? null,
  getShellElement: () => shellRef.value,
  focusEditor,
})
</script>

<template>
  <div
    ref="shellRef"
    class="composer-shell"
    :class="{
      'composer-shell--glow': showGlow,
      'composer-shell--inline': isPromptField,
      'composer-shell--shadow': !showGlow && !isPromptField,
    }"
    :style="composerStyle"
  >
    <PromptQueue
      v-if="!isPromptField && !hitlRequest"
      :prompts="queuedPrompts ?? []"
      @remove="emit('removeQueuedPrompt', $event)"
      @reorder="emit('reorderQueuedPrompt', $event)"
      @restore="handleRestoreQueuedPrompt"
    />

    <div v-if="hitlRequest" class="hitl-card" role="group" :aria-label="hitlRequest.title">
      <div class="hitl-card__header">
        <span>{{ hitlRequest.title }}</span>
        <div v-if="hasStructuredClarificationQuestions" class="hitl-card__clarification-nav">
          <span class="hitl-card__clarification-position">
            {{ clarificationQuestionIndex + 1 }} / {{ clarificationQuestions.length }}
          </span>
          <button
            class="hitl-card__clarification-nav-button"
            type="button"
            :title="$t('上一题')"
            :aria-label="$t('上一题')"
            :disabled="isHitlSubmitting || clarificationQuestionIndex === 0"
            @click="previousClarificationQuestion"
          >
            <SvgIcon name="base/rx_ic_arrow_left" size="16" color="currentColor" />
          </button>
          <button
            class="hitl-card__clarification-nav-button"
            type="button"
            :title="clarificationQuestionIndex === clarificationQuestions.length - 1 ? $t('提交回答') : $t('下一题')"
            :aria-label="clarificationQuestionIndex === clarificationQuestions.length - 1 ? $t('提交回答') : $t('下一题')"
            :disabled="isHitlSubmitting"
            @click="nextClarificationQuestion"
          >
            <SvgIcon name="base/rx_ic_arrow_right_2" size="16" color="currentColor" />
          </button>
        </div>
      </div>

      <p class="hitl-card__prompt">
        {{ displayedHitlPrompt }}
      </p>

      <div v-if="hitlRequest.subjects.length" class="hitl-card__subjects">
        <article v-for="subject in hitlRequest.subjects" :key="subject.id" class="hitl-card__subject">
          <div class="hitl-card__subject-title">
            {{ subject.title }}
          </div>
          <pre v-if="subject.diff" class="hitl-card__diff">{{ subject.diff }}</pre>
        </article>
      </div>

      <div v-if="shouldRenderClarificationEditor" class="hitl-card__clarification">
        <button
          v-for="(option, index) in clarificationOptions"
          :key="option.id"
          class="hitl-card__suggestion"
          :class="{ 'hitl-card__suggestion--selected': isClarificationOptionSelected(option) }"
          type="button"
          :aria-pressed="isClarificationOptionSelected(option)"
          :disabled="isHitlSubmitting"
          @click="chooseClarificationOption(option)"
        >
          <span class="hitl-card__badge">{{ index + 1 }}</span>
          <span class="hitl-card__suggestion-copy">
            <span class="hitl-card__suggestion-title">{{ getClarificationOptionTitle(option) }}</span>
            <AgentTooltip
              v-if="getClarificationOptionDescription(option)"
              :content="getClarificationOptionDescription(option)"
              :disabled="!isClarificationDescriptionOverflowing(option.id)"
              placement="top"
              trigger-class="hitl-card__suggestion-description-wrap"
            >
              <span
                :ref="el => setClarificationDescriptionRef(option.id, el)"
                class="hitl-card__suggestion-description"
              >{{ getClarificationOptionDescription(option) }}</span>
            </AgentTooltip>
          </span>
          <SvgIcon class="hitl-card__suggestion-arrow" name="base/rx_ic_arrow_right_2" size="18" color="currentColor" />
        </button>

        <label class="hitl-card__freeform">
          <span class="hitl-card__badge hitl-card__badge--edit">
            <SvgIcon name="base/rx_ic_agent_edit" size="14" color="currentColor" />
          </span>
          <input
            type="text"
            :value="getHitlInputValue(clarificationAnswerControlId)"
            :placeholder="clarificationInputPlaceholder"
            :disabled="isHitlSubmitting"
            @input="handleHitlInput(clarificationAnswerControlId, $event)"
            @keydown="handleClarificationKeydown"
          >
          <button
            class="hitl-card__skip"
            type="button"
            :disabled="isHitlSubmitting"
            @click="submitClarificationSkip"
          >
            {{ $t('跳过') }}
          </button>
        </label>
      </div>

      <div v-if="nonClarificationInputControls.length" class="hitl-card__inputs">
        <label v-for="control in nonClarificationInputControls" :key="control.id" class="hitl-card__field">
          <span v-if="control.label">{{ control.label }}</span>
          <textarea
            v-if="control.kind === 'textarea'"
            :value="getHitlInputValue(control.id)"
            :placeholder="control.placeholder"
            :disabled="isHitlSubmitting"
            @input="handleHitlInput(control.id, $event)"
          />
          <input
            v-else
            type="text"
            :value="getHitlInputValue(control.id)"
            :placeholder="control.placeholder"
            :disabled="isHitlSubmitting"
            @input="handleHitlInput(control.id, $event)"
          >
        </label>
      </div>

      <div v-if="nonClarificationChoiceControls.length" class="hitl-card__actions">
        <template v-for="control in nonClarificationChoiceControls" :key="control.id">
          <button
            v-for="option in control.options"
            :key="option.id"
            class="hitl-card__button"
            :class="`hitl-card__button--${option.variant ?? 'secondary'}`"
            type="button"
            :disabled="isHitlSubmitting"
            @click="submitHitlChoice(control, option.value)"
          >
            {{ option.label }}
          </button>
        </template>
      </div>
    </div>

    <div
      v-else
      ref="composerShellRef"
      class="composer"
      :class="{ 'composer--prompt-field': isPromptField, 'composer--readonly': readonly }"
      :aria-readonly="readonly || undefined"
      @click="focusEditor"
      @paste.capture="handleComposerPaste"
    >
      <input v-if="!isPromptField" ref="fileInputRef" class="composer-file-input" type="file" multiple @change="handleFileInputChange">
      <input
        v-if="!isPromptField"
        class="composer-file-input"
        type="file"
        multiple
        webkitdirectory
        directory
        @change="handleFolderInputChange"
      >

      <div class="composer-editor-area">
        <div v-if="!isPromptField && pendingAttachments.length" class="attachment-strip">
          <article v-for="attachment in pendingAttachments" :key="attachment.fileId" class="attachment-chip">
            <div class="attachment-chip__preview">
              <img v-if="isImageAttachment(attachment)" :src="getAttachmentPreview(attachment)" :alt="attachment.fileName">
              <SvgIcon v-else-if="attachment.kind === 'folder'" name="roxy-agent/rx-ic-folder" size="24" color="var(--color-text-disabled)" />
              <SvgIcon v-else name="roxy-agent/rx-ic-property" size="24" color="var(--color-text-disabled)" />
            </div>

            <div class="attachment-chip__meta">
              <div class="attachment-chip__name">
                {{ attachment.fileName }}
              </div>
              <div class="attachment-chip__type">
                {{ getAttachmentTypeLabel(attachment) }}
              </div>
            </div>

            <button
              class="attachment-chip__remove"
              type="button"
              :aria-label="$t('移除附件')"
              @click.stop="emit('removeAttachment', attachment.fileId)"
            >
              <SvgIcon name="roxy-agent/rx-ic-close2" size="14" color="currentColor" />
            </button>
          </article>
        </div>

        <div class="editor-wrap">
          <div v-if="isEmpty" class="composer-placeholder">
            <template v-if="isPromptField">
              {{ composerPlaceholder }}
            </template>
            <template v-else>
              {{ $t('直接对我说出您的需求，输入 {at} 选择窗口，/ 使用模板', { at: '@' }) }}
            </template>
          </div>
          <EditorContent v-if="editor" :editor="editor" />
        </div>
      </div>

      <div v-if="!isPromptField && missingPromptWarning" class="composer-warning">
        {{ missingPromptWarning }}
      </div>

      <div v-if="!isPromptField" class="composer-row">
        <ComposerToolbar @select="handleToolbarSelect" />

        <AgentTooltip :content="$t('停止')" placement="top" :disabled="!showStopButton">
          <button
            class="send-button"
            :class="{ thinking: showStopButton, loading: hasAttachmentUploading }"
            type="button"
            :aria-busy="hasAttachmentUploading || undefined"
            :aria-label="showStopButton ? $t('停止') : hasAttachmentUploading ? $t('上传中') : 'Send'"
            :disabled="!showStopButton && !composerCanSubmit"
            :title="showStopButton ? undefined : 'Send'"
            @click="handleSendButtonClick"
          >
            <span v-if="showStopButton" class="send-button__pause" aria-hidden="true" />
            <span v-else-if="hasAttachmentUploading" class="send-button__spinner" aria-hidden="true" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M7.33332 12.6667V4.49221C6.95089 4.8352 6.52102 5.29457 6.10806 5.7702C5.68411 6.2585 5.29087 6.74911 5.00259 7.11851C4.8588 7.30277 4.7416 7.45619 4.6608 7.56317C4.62041 7.61665 4.58874 7.65864 4.5677 7.68687C4.55723 7.70092 4.54948 7.71173 4.54426 7.71877C4.54165 7.72229 4.53964 7.72491 4.5384 7.72658L4.5371 7.72854L4.49348 7.78127C4.26672 8.03171 3.88276 8.07497 3.60481 7.87046C3.30842 7.65219 3.24476 7.23462 3.46288 6.93817H3.46353V6.93752L3.46418 6.93687C3.46462 6.93627 3.46539 6.93527 3.46614 6.93427C3.46772 6.93213 3.46979 6.92901 3.47265 6.92515C3.47863 6.91708 3.48737 6.90518 3.49869 6.88999C3.52129 6.85967 3.5542 6.81558 3.59635 6.75979C3.68076 6.64802 3.80239 6.48884 3.95116 6.2982C4.24817 5.91761 4.65733 5.40815 5.10155 4.8965C5.54288 4.3882 6.03209 3.86267 6.48892 3.459C6.71652 3.2579 6.9516 3.07257 7.18098 2.93427C7.39214 2.80697 7.68257 2.66669 7.99999 2.66669C8.31741 2.66669 8.60786 2.80698 8.819 2.93427C9.04838 3.07257 9.28347 3.25791 9.51106 3.459C9.96789 3.86266 10.4571 4.38821 10.8984 4.8965C11.3427 5.40815 11.7518 5.91762 12.0488 6.2982C12.1976 6.48884 12.3192 6.64803 12.4036 6.75979C12.4458 6.81558 12.4787 6.85967 12.5013 6.88999C12.5126 6.90517 12.5214 6.91708 12.5273 6.92515C12.5302 6.92901 12.5323 6.93213 12.5338 6.93427C12.5346 6.93528 12.5354 6.93627 12.5358 6.93687L12.5364 6.93752V6.93817H12.5371C12.7552 7.23462 12.6916 7.65218 12.3952 7.87046C12.0987 8.08858 11.6812 8.02492 11.4629 7.72854L11.4616 7.72658C11.4603 7.72491 11.4583 7.7223 11.4557 7.71877C11.4505 7.71173 11.4428 7.70092 11.4323 7.68687C11.4112 7.65864 11.3796 7.61665 11.3392 7.56317C11.2584 7.45619 11.1412 7.30277 10.9974 7.11851C10.7091 6.74911 10.3159 6.2585 9.89192 5.7702C9.47896 5.29458 9.04909 4.8352 8.66666 4.49221V12.6667C8.66666 13.0349 8.36818 13.3334 7.99999 13.3334C7.6318 13.3334 7.33332 13.0349 7.33332 12.6667Z" fill="white" />
            </svg>
          </button>
        </AgentTooltip>
      </div>
    </div>

    <SuggestionMenu
      :anchor="composerShellRef"
      :all-selected="allMentionItemsSelected"
      :has-more="profileHasMore"
      :load-error="profileLoadError"
      :loading-more="profileLoadingMore"
      :project-options="projectOptions"
      :selected-count="selectedMentionCount"
      :selected-ids="selectedMentionIds"
      :selected-project-id="selectedProjectId"
      :select-all-loading="profileSelectingAll || profileReloading"
      :state="suggestion"
      @cancel="cancelMentionSelection"
      @choose="chooseItem"
      @confirm="confirmMentionSelection"
      @dismiss="dismissSuggestionMenu"
      @hover="setActiveSuggestion"
      @load-more="loadMoreProfiles"
      @navigate="navigateSuggestion"
      @project-change="updateSelectedProject"
      @read="markSuggestionItemRead"
      @retry="retryLoadProfiles"
      @search="updateSuggestionQuery"
      @toggle-all="toggleAllMentionItems"
      @toggle-top="toggleSuggestionItemTop"
    />

    <Teleport to="body">
      <div
        v-if="inputEditor.open"
        ref="inputTokenPopoverRef"
        class="input-token-popover"
        :class="`input-token-popover--${inputTokenPopoverPlacement}`"
        :style="inputTokenPopoverStyle"
        @click.stop
      >
        <div class="input-token-popover__label">
          {{ inputEditor.label }}
        </div>
        <div
          class="input-token-popover__row"
          :class="{
            'input-token-popover__row--textarea': inputEditor.kind === 'textarea',
            'input-token-popover__row--textarea-multiline': inputEditor.kind === 'textarea' && inputTokenTextareaMultiline,
          }"
        >
          <div
            class="input-token-popover__input"
            :class="{
              'input-token-popover__input--url': inputEditor.kind === 'url',
              'input-token-popover__input--textarea': inputEditor.kind === 'textarea',
            }"
          >
            <span v-if="inputEditor.kind === 'url'" class="input-token-popover__protocol">{{ inputUrlProtocol }}</span>
            <div
              v-if="inputEditor.kind === 'textarea'"
              class="input-token-popover__resize-handle"
              @pointerdown.stop="handleInputTokenTextareaResizeStart"
            />
            <textarea
              v-if="inputEditor.kind === 'textarea'"
              ref="inputTokenInputRef"
              v-model="inputTokenValue"
              rows="1"
              :placeholder="$t('请输入内容')"
              @compositionend="inputTokenComposing = false"
              @compositionstart="inputTokenComposing = true"
              @keydown="handleInputTokenKeydown"
            />
            <input
              v-else
              ref="inputTokenInputRef"
              v-model="inputTokenValue"
              type="text"
              :placeholder="inputEditor.kind === 'url' ? 'example.com' : $t('请输入内容')"
              @compositionend="inputTokenComposing = false"
              @compositionstart="inputTokenComposing = true"
              @keydown="handleInputTokenKeydown"
              @paste="inputEditor.kind === 'url' && handleUrlTokenPaste($event)"
            >
          </div>
          <div ref="inputTokenActionsRef" class="input-token-popover__actions">
            <button type="button" class="input-token-popover__button" @click="cancelInputTokenEdit">
              {{ $t('取消') }}
            </button>
            <button type="button" class="input-token-popover__button input-token-popover__button--primary" @click="submitInputTokenEdit">
              {{ $t('确定') }}
            </button>
          </div>
        </div>
        <span class="input-token-popover__arrow" aria-hidden="true" />
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.composer-shell {
  --agent-composer-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.08);

  position: absolute;
  bottom: 39px;
  left: 50%;
  z-index: 5;
  display: flex;
  width: var(--agent-chat-content-width, min(800px, calc(100% - 68px)));
  transform: translateX(-50%);
  flex-direction: column;
  align-items: center;
  pointer-events: none;

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    z-index: 0;
    width: 100%;
    border-radius: 16px;
    background: linear-gradient(
      140.743deg,
      rgba(63, 170, 246, 0.3) 10.127%,
      rgba(243, 89, 220, 0.3) 44.937%,
      rgba(242, 143, 176, 0.3) 100%
    );
    filter: blur(25px);
    pointer-events: none;
    transform: translateX(-50%);
  }
}

.composer-shell--shadow .composer,
.composer-shell--shadow .hitl-card {
  box-shadow: var(--agent-composer-shadow);
}

.composer-shell--glow::before {
  content: '';
}
.composer-shell--inline {
  position: relative;
  bottom: auto;
  left: auto;
  z-index: auto;
  width: 100%;
  align-items: stretch;
  pointer-events: auto;
  transform: none;

  &::before {
    display: none;
  }
}

:global([data-theme='dark']) .composer-shell {
  --agent-composer-shadow: 0 0 20px 0 rgba(255, 255, 255, 0.08);
}

.thinking-strip {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 48px;
  align-items: center;
  justify-content: center;
  color: #c11574;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  pointer-events: auto;
}

.hitl-card {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
  pointer-events: auto;
}

.hitl-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.hitl-card__clarification-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hitl-card__clarification-position {
  min-width: 32px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  text-align: right;
}

.hitl-card__clarification-nav-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  appearance: none;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    background: var(--color-bg-secondary, #f5f5f5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
}

.hitl-card__prompt {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.hitl-card__subjects {
  display: flex;
  max-height: 180px;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.hitl-card__subject {
  min-width: 0;
}

.hitl-card__subject-title {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hitl-card__diff {
  max-height: 128px;
  margin: 4px 0 0;
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary, var(--color-bg-primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  white-space: pre;
}

.hitl-card__inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hitl-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 16px;
}

.hitl-card__field input,
.hitl-card__field textarea {
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  outline: none;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
  font: inherit;
  line-height: 18px;
}

.hitl-card__field textarea {
  max-height: 48px;
  resize: none;
}

.hitl-card__clarification {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hitl-card__suggestion,
.hitl-card__freeform {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  border: 0;
  border-radius: 20px;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary, #f5f5f5);
  box-sizing: border-box;
}

.hitl-card__suggestion {
  appearance: none;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary, #f0f0f0);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.hitl-card__badge {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 50%;
  color: var(--color-text-tertiary);
  background: var(--color-bg-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.hitl-card__badge--edit {
  color: var(--color-text-secondary);
}

.hitl-card__suggestion-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 6px 0;
}

.hitl-card__suggestion-title {
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: normal;
  word-break: break-word;
}

:deep(.hitl-card__suggestion-description-wrap) {
  display: block;
  min-width: 0;
}

.hitl-card__suggestion-description {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hitl-card__suggestion-arrow {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
}

.hitl-card__freeform {
  background: transparent;
}

.hitl-card__freeform input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  color: var(--color-text-primary);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  &::placeholder {
    color: var(--color-text-tertiary);
    font-weight: 400;
  }
}

.hitl-card__skip {
  flex: 0 0 auto;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  appearance: none;
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    background: var(--color-bg-secondary, #f5f5f5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.hitl-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.hitl-card__button {
  display: inline-flex;
  min-width: 55px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  appearance: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.hitl-card__button--secondary,
.hitl-card__button--danger {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.hitl-card__button--primary {
  border-color: var(--color-bg-primary-inverse);
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);
}

@media (max-width: 600px) {
  .hitl-card {
    padding: 14px;
  }

  .hitl-card__suggestion,
  .hitl-card__freeform {
    min-height: 44px;
    gap: 10px;
    border-radius: 14px;
  }

  .hitl-card__suggestion-copy {
    gap: 1px;
  }
}

.composer {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: 128px;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
  pointer-events: auto;
}
.composer--prompt-field {
  min-height: var(--agent-prompt-field-min-height, 76px);
  gap: 0;
  justify-content: flex-start;
  padding: 12px;
  border-radius: 8px;
  box-shadow: none;

  .editor-wrap,
  :deep(.agent-composer-editor) {
    min-height: calc(var(--agent-prompt-field-min-height, 76px) - 26px);
  }

  :deep(.agent-composer-editor) {
    max-height: 280px;
  }
}

.composer--readonly {
  cursor: default;

  :deep(.agent-token),
  :deep(.mention) {
    cursor: default;
  }

  :deep(.agent-token__remove) {
    display: none;
  }
}

.composer-file-input {
  display: none;
}

.attachment-strip {
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  align-items: flex-start;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-color: var(--color-border-secondary) transparent;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: var(--color-border-secondary);
  }
}

.attachment-chip {
  position: relative;
  display: flex;
  width: 128px;
  max-width: 260px;
  min-width: 128px;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 33px 8px 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
}

.attachment-chip__preview {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-bg-tertiary);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.attachment-chip__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  font-size: 14px;
  line-height: 20px;
}

.attachment-chip__name {
  width: 100%;
  overflow: hidden;
  color: var(--color-text-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-chip__type {
  width: 100%;
  overflow: hidden;
  color: var(--color-text-disabled);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-chip__remove {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  width: 14px;
  height: 14px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 999px;
  appearance: none;
  color: var(--color-fg-primary);
  background: transparent;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.composer-editor-area {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.editor-wrap {
  position: relative;
  min-height: 40px;
}

.composer-placeholder {
  position: absolute;
  inset: 0;
  color: var(--color-text-tertiary);
  font-size: 14px;
  font-weight: 400;
  line-height: 24px;
  pointer-events: none;
}

.composer-warning {
  color: #c2410c;
  font-size: 13px;
  line-height: 18px;
}

:deep(.agent-composer-editor) {
  position: relative;
  z-index: 1;
  min-height: 24px;
  max-height: 144px;
  box-sizing: border-box;
  overflow-y: auto;
  outline: none;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 24px;
  word-break: break-word;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 6px;
  }

  a {
    color: var(--color-text-blue);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  a[data-agent-favicon-url] {
    position: relative;
  }

  a[data-agent-favicon-url]::before,
  a[data-agent-favicon-url]::after {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 4px;
    content: '';
    vertical-align: -2px;
    pointer-events: none;
  }

  a[data-agent-favicon-url]::before {
    background-color: var(--color-text-tertiary);
    mask: var(--agent-favicon-fallback-image) center / contain no-repeat;
    -webkit-mask: var(--agent-favicon-fallback-image) center / contain no-repeat;
    opacity: var(--agent-favicon-fallback-opacity, 1);
    transform: scale(var(--agent-favicon-fallback-scale, 1));
    transition:
      opacity 0.12s ease,
      transform 0.12s ease;
  }

  a[data-agent-favicon-url]::after {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    background-image: var(--agent-favicon-image);
    background-position: center;
    background-size: contain;
    background-repeat: no-repeat;
    opacity: var(--agent-favicon-opacity, 0);
    transform: translateY(2px) scale(var(--agent-favicon-scale, 0.85));
    transition:
      opacity 0.12s ease,
      transform 0.12s ease;
  }
}

:deep(.agent-token),
:deep(.mention) {
  display: inline-flex;
  max-width: 280px;
  min-height: 24px;
  align-items: center;
  box-sizing: border-box;
  gap: 4px;
  margin: 0 2px;
  padding: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 18px;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(.agent-token__icon) {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: none;
  align-items: center;
  justify-content: center;
}

:deep(.agent-token__icon roxy-svg-icon) {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

:deep(.agent-token__label) {
  min-width: 0;
  overflow: hidden;
  pointer-events: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.agent-token__profile-prefix),
:deep(.agent-token__profile-detail) {
  display: inline-flex;
  width: max-content;
  min-height: 24px;
  flex: none;
  align-items: center;
  box-sizing: border-box;
  gap: 4px;
  padding: 2px 6px;
}

:deep(.agent-token__profile-prefix) {
  border-radius: 8px 0 0 8px;
  background: var(--color-bg-tag-purple);
}

:deep(.agent-token__profile-detail) {
  min-width: 0;
  border-radius: 0 8px 8px 0;
  background: var(--color-bg-tag-purple-hover);
}

:deep(.agent-token__profile-names) {
  flex: none;
  pointer-events: none;
  white-space: nowrap;
}

:deep(.agent-token__remove) {
  display: inline-flex;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: currentColor;
  cursor: pointer;
  opacity: 0.72;
}

:deep(.agent-token__remove:hover) {
  opacity: 1;
}

:deep(.agent-token__remove roxy-svg-icon) {
  display: inline-flex;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

:deep(.agent-token--profile),
:deep(.mention) {
  width: max-content;
  max-width: none;
  flex: none;
  color: var(--color-text-tag-purple);
  background: transparent;
  font-size: 14px;
  font-weight: 400;
}

:deep(.agent-token--profile .agent-token__label),
:deep(.mention .agent-token__label) {
  overflow: visible;
  flex: none;
  text-overflow: clip;
  white-space: nowrap;
}

:deep(.agent-token--profile:not(.agent-token--profile-empty)) {
  gap: 0;
  padding: 0;
}

:deep(.agent-token--profile-empty) {
  gap: 4px;
  padding: 2px 8px;
  border: 1px dashed #7a5af8;
  background: var(--color-bg-tag-purple);
}

:deep(.agent-token--skill) {
  color: var(--color-text-tag-pink);
  background: var(--color-bg-tag-pink);
}

:deep(.agent-token--script) {
  color: var(--color-text-tag-blue);
  background: var(--color-bg-tag-blue);
}

:deep(.agent-token--input),
:deep(.agent-token--textarea),
:deep(.agent-token--url) {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

:deep(.agent-token--input-empty) {
  border: 1px dashed currentColor;
  color: #c2410c;
  background: rgba(251, 146, 60, 0.12);
}

.input-token-popover {
  position: fixed;
  z-index: 80;
  display: flex;
  width: min(460px, calc(100vw - 24px));
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
  pointer-events: auto;
}

.input-token-popover__label {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-token-popover__row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.input-token-popover__row--textarea {
  align-items: flex-start;
}

.input-token-popover__row--textarea-multiline {
  flex-direction: column;
  align-items: stretch;
}

.input-token-popover__input {
  min-width: 0;
  flex: 1;
  height: 32px;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-primary);
}

.input-token-popover__input--textarea {
  position: relative;
  height: auto;
  align-items: stretch;
}

.input-token-popover__row--textarea-multiline .input-token-popover__input {
  width: 100%;
}

.input-token-popover__input--textarea textarea {
  max-height: min(40vh, 320px);
}

.input-token-popover__resize-handle {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  width: 100%;
  height: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ns-resize;
  touch-action: none;

  &::after {
    position: absolute;
    top: 3px;
    left: 50%;
    width: 32px;
    height: 3px;
    border-radius: 999px;
    background: var(--color-border-secondary);
    content: '';
    transform: translateX(-50%);
  }
}

.input-token-popover__input input,
.input-token-popover__input textarea {
  min-width: 0;
  flex: 1;
  padding: 6px 10px;
  border: 0;
  outline: none;
  color: var(--color-text-primary);
  background: transparent;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
}

.input-token-popover__input input {
  height: 100%;
}

.input-token-popover__input textarea {
  height: 30px;
  min-height: 30px;
  max-height: 118px;
  display: block;
  overflow-y: hidden;
  line-height: 18px;
  resize: none;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.input-token-popover__input:focus-within {
  border-color: var(--color-bg-primary-inverse);
}

.input-token-popover__protocol {
  display: flex;
  height: 100%;
  flex: none;
  align-items: center;
  padding: 0 8px;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  user-select: none;
}

.input-token-popover__actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.input-token-popover__row--textarea-multiline .input-token-popover__actions {
  width: 100%;
  justify-content: flex-start;
}

.input-token-popover__actions--moving {
  animation: input-token-actions-move 160ms ease-out;
}

@keyframes input-token-actions-move {
  from {
    opacity: 0.78;
    transform: translate(var(--input-token-actions-from-x, 0), var(--input-token-actions-from-y, 0));
  }

  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

.input-token-popover__button {
  display: inline-flex;
  flex: none;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  appearance: none;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
}

.input-token-popover__button--primary {
  border-color: var(--color-bg-primary-inverse);
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);
}

.input-token-popover__arrow {
  position: absolute;
  left: 50%;
  width: 0;
  height: 0;
  border-right: 6px solid transparent;
  border-left: 6px solid transparent;
  transform: translateX(-50%);
}

.input-token-popover--top .input-token-popover__arrow {
  bottom: -6px;
  border-top: 6px solid var(--color-border-secondary);
}

.input-token-popover--bottom .input-token-popover__arrow {
  top: -6px;
  border-bottom: 6px solid var(--color-border-secondary);
}

.composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 0;
  border-radius: 999px;
  appearance: none;
  width: 32px;
  height: 32px;
  flex: none;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(101deg, #3faaf6 10.13%, #f359dc 44.94%, #f28fb0 100%);
  transition:
    filter 0.15s ease,
    box-shadow 0.15s ease;

  &.thinking:not(:disabled):hover {
    filter: brightness(0.92);
    box-shadow: 0 2px 8px rgba(63, 170, 246, 0.35);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.send-button__pause {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: currentColor;
}

.send-button__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: attachment-upload-spin 0.8s linear infinite;
}

@keyframes attachment-upload-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
