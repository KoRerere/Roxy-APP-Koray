<script setup lang="ts">
import type { UserTemplateCreate } from '@roxy/agent-api'
import type { CustomTemplatePayload, UserTemplateDTO } from '../my-templates'
import type { AgentAttachment, AgentFolderSelection, AgentHitlRequest, AgentHitlSubmitPayload, AgentMessage, AgentPathSelection, AgentTodoProgress } from '../types'
import type { SvgNames } from '/@/components/rx-icon'
import type { OfficialTemplate, TemplateKind } from '../template-store'
import type { AgentComposerItem } from './chat-composer/types'
import {
  serializeAgentProfileReference,
  serializeAgentSkillReference,
  serializeTemplateRef,
} from '@roxy/shared'
import { useElementSize } from '@vueuse/core'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useAgentConsoleApi } from '../api'
import { HOME_TEMPLATE_CACHE_LIMIT, readHomeTemplateCache, writeHomeTemplateCache } from '../home-template-cache'
import {
  buildCustomTemplateRequest,
  readUserTemplateMutation,
  readUserTemplatePage,
} from '../my-templates'
import {
  prepareOfficialTemplateAcquisition,
} from '../official-template-acquisition'
import { markTemplateRead, markTemplateUnread } from '../template-unread'
import {
  isTemplateImageIconSource,
  mapTemplateStoreItem,
  pickOfficialTemplatePrompt,
  pickTemplateThemeValue,
  readCatalogList,
  serializeTemplateQuery,
} from '../template-store'
import AgentConsolePageLayout from './AgentConsolePageLayout.vue'
import AgentOnboarding from './AgentOnboarding.vue'
import CreateTemplateDialog from './dialog/CreateTemplateDialog.vue'
import HomeTemplateCardSkeleton from './skeleton/HomeTemplateCardSkeleton.vue'
import ChatComposer from './ChatComposer.vue'
import { useDialog } from 'primevue/usedialog'
import {
  mapRecommendedTemplateComposerItem,
  mapUserTemplateComposerItem,
  scriptTemplateToRunPrompt,
  userTemplateToPrompt,
} from './chat-composer/templateItems'
import ChatMessageList from './ChatMessageList.vue'
import OverflowTooltip from './OverflowTooltip.vue'
import TaskMonitorToggle from './TaskMonitorToggle.vue'
import SelectWindowGuide from './SelectWindowGuide.vue'
import {
  announceNewTemplateCreated,
  clearNewTemplateGuidePending,
  getAgentConsoleAccountId,
  hasNewTemplateGuidePending,
  hasShownNewTemplateGuide,
  markNewTemplateGuidePending,
  markNewTemplateGuideShown,
  NEW_TEMPLATE_GUIDE_EVENT,
} from '../template-guide'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'
import {
  AI_BATCH_CREATE_GUIDE_EVENT,
  clearPendingAiBatchCreateGuide,
  hasPendingAiBatchCreateGuide,
  hasShownAiBatchCreateGuide,
  isAiBatchCreateGuideForced,
  markAiBatchCreateGuideShown,
  requestAiBatchCreateGuide,
} from '../batch-create-guide'
import {
  AI_BATCH_CREATE_TEMPLATE_SLUG,
  pickAiBatchCreatePrompt,
} from '../batch-create-prefill'
import {
  clearPendingCreateAutomationGuide,
  CREATE_AUTOMATION_GUIDE_EVENT,
  hasPendingCreateAutomationGuide,
  hasShownCreateAutomationGuide,
  markCreateAutomationGuideShown,
} from '../create-automation-guide'

interface ChatComposerExpose {
  focusEditor: () => void
  getComposerElement: () => HTMLElement | null
  getEmptyInputTokenElement: () => HTMLElement | null
  getEmptyProfileTokenElement: () => HTMLElement | null
  getSelectTemplateButtonElement: () => HTMLElement | null
  getSelectWindowButtonElement: () => HTMLElement | null
  getShellElement: () => HTMLElement | null
}

const ONBOARDING_SCRIPT_TEMPLATE_SLUGS = {
  nurture: 'official-tiktok-for-you-nurture',
  analytics: 'official-tiktok-comment-analyzer',
} as const

type OnboardingScriptTemplateSlug = typeof ONBOARDING_SCRIPT_TEMPLATE_SLUGS[keyof typeof ONBOARDING_SCRIPT_TEMPLATE_SLUGS]

interface DroppedFileEntry {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void
  isDirectory: false
  isFile: true
  name: string
}

interface DroppedDirectoryEntry {
  createReader: () => {
    readEntries: (success: (entries: DroppedFileSystemEntry[]) => void, error?: (error: DOMException) => void) => void
  }
  isDirectory: true
  isFile: false
  name: string
}

type DroppedFileSystemEntry = DroppedFileEntry | DroppedDirectoryEntry

interface DroppedTransferEntry {
  entry: DroppedFileSystemEntry
  item: DataTransferItem
}

interface TemplateCard {
  id: number
  title: string
  description: string
  iconName: SvgNames
  iconSize: 32 | 44
  imageIcon: string
  iconColor: string
  iconBackground: string
  kind: TemplateKind
  tags: {
    id: number | string
    label: string
    tone?: 'script' | 'ai'
  }[]
  prompt: string
}

const props = defineProps<{
  activeConversationId?: string
  composerFocusKey?: number
  conversationTitle?: string
  hitlRequest?: AgentHitlRequest
  messages: AgentMessage[]
  pendingAttachments: AgentAttachment[]
  thinking: boolean
  todoProgress?: AgentTodoProgress
}>()

const emit = defineEmits<{
  addAttachments: [files: File[]]
  addFolder: [folder: AgentFolderSelection]
  addPathAttachment: [selection: AgentPathSelection]
  removeAttachment: [fileId: string]
  send: []
  stop: []
  submitHitl: [payload: AgentHitlSubmitPayload]
}>()

const prompt = defineModel<string>('prompt', { required: true })

const route = useRoute()
const router = useRouter()
const [showToast, onlyErrorToast] = useResponseToast()

const composerRef = ref<ChatComposerExpose | null>(null)
const composerShellElement = shallowRef<HTMLElement | null>(null)
const dragDepth = ref(0)
const officialTemplates = ref<OfficialTemplate[]>([])
const templateCardsLoading = ref(true)
const recommendedTemplates = shallowRef(new Map<number, UserTemplateDTO>())
const resolvingTemplateId = ref<number>()
const selectWindowGuideVisible = ref(false)
const selectWindowGuideTarget = shallowRef<HTMLElement | null>(null)
const selectWindowGuideLabel = ref('')
const aiBatchCreateGuideVisible = ref(false)
const aiBatchCreateGuideTarget = shallowRef<HTMLElement | null>(null)
const aiBatchCreateGuideLabel = ref('')
const createAutomationGuideVisible = ref(false)
const createAutomationGuideTarget = shallowRef<HTMLElement | null>(null)
const createAutomationGuideLabel = ref('')
const newTemplateGuideVisible = ref(false)
const newTemplateGuideTarget = shallowRef<HTMLElement | null>(null)
const newTemplateGuideLabel = ref('')
const onboardingVisible = ref(false)
const onboardingSessionKey = ref(0)
const agentApi = useAgentConsoleApi()
const dialog = useDialog()
const localeStore = useSimpleLocale()
const themeStore = useThemeStore()
const userStore = useUserStore()
const { height: composerShellHeight } = useElementSize(composerShellElement)

const COMPOSER_BOTTOM_OFFSET = 39
const USER_TEMPLATE_PAGE_SIZE = 200
const COMPOSER_MESSAGE_GAP = 35
const SCROLL_BUTTON_GAP = 14
const DEFAULT_COMPOSER_HEIGHT = 176
const TEMPLATE_CARD_COUNT = HOME_TEMPLATE_CACHE_LIMIT
const SELECT_WINDOW_GUIDE_STORAGE_PREFIX = 'agent-console:recommended-template-select-window-guide:'
let recommendedTemplatesPromise: Promise<void> | undefined
let recommendedTemplatesLoaded = false

const cachedTemplateCards = readHomeTemplateCache()?.templates ?? []
if (cachedTemplateCards.length) {
  officialTemplates.value = cachedTemplateCards
  templateCardsLoading.value = false
}

const defaultIconByKind = {
  script: {
    name: 'roxy-agent/rx-ic-scripts',
    color: 'var(--color-fg-tertiary)',
  },
  skill: {
    name: 'roxy-agent/rx-ic-skills',
    color: 'var(--color-fg-tertiary)',
  },
  prompt: {
    name: 'roxy-agent/rx-ic-prompts',
    color: 'var(--color-fg-tertiary)',
  },
} as const satisfies Record<TemplateKind, {
  name: SvgNames
  color: string
}>

const isHome = computed(() => !props.activeConversationId)
const showComposerGlow = computed(() => isHome.value && props.messages.length === 0)
const isDraggingFiles = computed(() => dragDepth.value > 0)
const displayConversationTitle = computed(() => props.conversationTitle?.trim() || $t('新建对话'))
const composerOccupiedBottom = computed(() => {
  return Math.ceil((composerShellHeight.value || DEFAULT_COMPOSER_HEIGHT) + COMPOSER_BOTTOM_OFFSET)
})
const composerReservedBottom = computed(() => composerOccupiedBottom.value + COMPOSER_MESSAGE_GAP)
const scrollButtonBottom = computed(() => composerOccupiedBottom.value + SCROLL_BUTTON_GAP)
const chatContainerStyle = computed(() => ({
  '--agent-composer-reserved-bottom': `${composerReservedBottom.value}px`,
  '--agent-scroll-button-bottom': `${scrollButtonBottom.value}px`,
}))
const composerAutoFocusKey = computed(() => `${props.activeConversationId ?? 'home'}:${props.composerFocusKey ?? 0}`)
const templateCards = computed<TemplateCard[]>(() => officialTemplates.value.slice(0, TEMPLATE_CARD_COUNT).map((row) => {
  const item = mapTemplateStoreItem(row, localeStore.currentLocale)
  const darkTheme = themeStore.realTheme === 'dark'
  const templateIcon = pickTemplateThemeValue(item.iconInfo?.icon, darkTheme)
  const imageIcon = templateIcon && isTemplateImageIconSource(templateIcon) ? templateIcon : ''
  const iconName = !imageIcon && templateIcon ? templateIcon as SvgNames : defaultIconByKind[item.kind].name
  const iconColor = pickTemplateThemeValue(item.iconInfo?.primaryColor, darkTheme) || defaultIconByKind[item.kind].color
  const iconBackground = pickTemplateThemeValue(item.iconInfo?.bgColor, darkTheme) || 'var(--color-bg-tertiary)'
  return {
    id: item.id,
    title: item.title,
    description: item.description || $t('暂无描述'),
    iconName,
    iconSize: templateIcon ? 44 : 32,
    imageIcon,
    iconColor,
    iconBackground,
    kind: item.kind,
    tags: [
      ...item.labels.slice(0, 2).map(label => ({
        id: label.id,
        label: label.label,
      })),
    ],
    prompt: pickOfficialTemplatePrompt(row, localeStore.currentLocale) || item.description || item.title,
  }
}))
const recommendedTemplateItems = computed<AgentComposerItem[]>(() => templateCards.value.map((card) => {
  const installedTemplate = recommendedTemplates.value.get(card.id)
  if (!installedTemplate) {
    return mapRecommendedTemplateComposerItem(card)
  }

  return mapUserTemplateComposerItem(installedTemplate, localeStore.currentLocale)
}))

async function loadTemplateCards() {
  const endLoadTemplateCards = createPerfTimer('chat-workspace:loadTemplateCards')
  templateCardsLoading.value = officialTemplates.value.length === 0
  try {
    const response = await agentApi.templates.listOfficialTemplates(
      { limit: TEMPLATE_CARD_COUNT },
      { paramsSerializer: serializeTemplateQuery },
    )
    const templates = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))
    officialTemplates.value = templates
    writeHomeTemplateCache(templates)
  }
  catch (error) {
    console.error('[agent-console] Failed to load template cards:', error)
  }
  finally {
    templateCardsLoading.value = false
    endLoadTemplateCards({
      templateCount: officialTemplates.value.length,
    })
  }
}

async function loadRecommendedTemplates() {
  if (recommendedTemplatesLoaded) {
    perfLog('chat-workspace:loadRecommendedTemplates:skip-loaded')
    return
  }
  if (recommendedTemplatesPromise) {
    perfLog('chat-workspace:loadRecommendedTemplates:reuse-pending')
    return recommendedTemplatesPromise
  }

  const endLoadRecommendedTemplates = createPerfTimer('chat-workspace:loadRecommendedTemplates')
  const request = (async () => {
    await agentApi.initializePresetTemplates()

    const matchedTemplates = new Map<number, UserTemplateDTO>()
    let offset = 0
    let total = 0

    do {
      const response = await agentApi.userTemplates.listUserTemplates({
        limit: USER_TEMPLATE_PAGE_SIZE,
        offset,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      })
      const page = readUserTemplatePage(response, $t('加载推荐模板失败'))

      page.items.forEach((template) => {
        if (typeof template.officialTemplateId === 'number' && !matchedTemplates.has(template.officialTemplateId)) {
          matchedTemplates.set(template.officialTemplateId, template)
        }
      })

      total = page.total
      offset += page.items.length
      if (!page.items.length) {
        break
      }
    } while (offset < total)

    recommendedTemplates.value = matchedTemplates
  })()
  recommendedTemplatesPromise = request

  try {
    await request
    recommendedTemplatesLoaded = true
  }
  catch (error) {
    recommendedTemplatesLoaded = false
    throw error
  }
  finally {
    if (recommendedTemplatesPromise === request) {
      recommendedTemplatesPromise = undefined
    }
    endLoadRecommendedTemplates({
      loaded: recommendedTemplatesLoaded,
      templateCount: recommendedTemplates.value.size,
    })
  }
}

function storeRecommendedTemplate(template: UserTemplateDTO) {
  if (typeof template.officialTemplateId !== 'number')
    return template

  const nextTemplates = new Map(recommendedTemplates.value)
  nextTemplates.set(template.officialTemplateId, template)
  recommendedTemplates.value = nextTemplates
  return template
}

async function createOfficialUserTemplate(request: UserTemplateCreate) {
  try {
    const response = await agentApi.userTemplates.createUserTemplate(request)
    const template = storeRecommendedTemplate(
      readUserTemplateMutation(response, $t('获取模板失败')),
    )
    markTemplateUnread(template)
    showToast(0, $t('模板已添加，点击查看详情'), {
      onClick: () => {
        void router.push({
          name: 'agent-console-my-templates',
          query: { ...route.query, editTemplateId: String(template.id) },
        })
      },
    })
    return template
  }
  catch (error) {
    console.error('Failed to acquire recommended template', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('获取模板失败'))
    return undefined
  }
}

function acquireTemplateWithDialog(
  officialTemplate: OfficialTemplate,
): Promise<UserTemplateDTO | undefined> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (template?: UserTemplateDTO) => {
      if (settled)
        return
      settled = true
      resolve(template)
    }

    try {
      dialog.open(CreateTemplateDialog, {
        props: {
          modal: true,
          blockScroll: true,
          dismissableMask: false,
          draggable: false,
          showHeader: false,
          style: { width: 'min(540px, calc(100vw - 32px))' },
          pt: {
            root: 'agent-console-dialog agent-console-create-template-dialog',
            content: '!p-0 !overflow-hidden',
          },
        },
        data: {
          officialTemplate,
          lockSource: true,
          submitMode: 'run',
          onCancel: () => finish(),
          onSave: async (payload: CustomTemplatePayload) => {
            const template = await createOfficialUserTemplate(buildCustomTemplateRequest(payload))
            if (!template) {
              return false
            }
            finish(template)
            return true
          },
        },
        onClose: () => finish(),
      })
    }
    catch (error) {
      reject(error)
    }
  })
}

async function ensureRecommendedTemplate(card: TemplateCard) {
  await loadRecommendedTemplates()

  const installedTemplate = recommendedTemplates.value.get(card.id)
  if (installedTemplate) {
    return { template: installedTemplate, acquired: false }
  }

  const officialTemplate = officialTemplates.value.find(template => template.id === card.id)
  if (!officialTemplate) {
    throw new Error($t('官方模板不存在或已下架'))
  }

  const acquisition = prepareOfficialTemplateAcquisition(
    officialTemplate,
    localeStore.currentLocale,
  )
  const template = acquisition.requiresConfirmation
    ? await acquireTemplateWithDialog(officialTemplate)
    : await createOfficialUserTemplate(acquisition.request)

  return template ? { template, acquired: true } : undefined
}

function getSkillUsageExample(card: TemplateCard) {
  const officialTemplate = officialTemplates.value.find(item => item.id === card.id)
  return pickOfficialTemplatePrompt(officialTemplate, localeStore.currentLocale)
}

function updatePromptAndFocus(value: string) {
  prompt.value = value
  void nextTick(() => {
    composerRef.value?.focusEditor()
  })
}

function addSelectionToCurrentChat(text: string) {
  const separator = prompt.value && !prompt.value.endsWith('\n') ? '\n' : ''
  updatePromptAndFocus(`${prompt.value}${separator}${text}`)
}

function markNewTemplateGuidePendingForCurrentAccount() {
  const accountId = getAgentConsoleAccountId(userStore.userInfo)
  if (!accountId)
    return

  markNewTemplateGuidePending(accountId)
  announceNewTemplateCreated()
}

function openSaveAsPromptDialog(text: string) {
  dialog.open(CreateTemplateDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(540px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-create-template-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      initialKind: 'prompt',
      initialPrompt: text,
      lockKind: true,
      submitMode: 'save',
      onSave: async (payload: CustomTemplatePayload) => {
        const created = await createOfficialUserTemplate(buildCustomTemplateRequest(payload))
        if (!created)
          return false

        markNewTemplateGuidePendingForCurrentAccount()
        return true
      },
    },
  })
}

async function useTemplate(card: TemplateCard) {
  if (card.kind === 'script') {
    const scriptPrompt = scriptTemplateToRunPrompt(
      card.title,
      serializeTemplateRef('official', card.id),
    )
    if (!scriptPrompt) {
      onlyErrorToast(-1, $t('脚本引用为空'))
      return false
    }
    updatePromptAndFocus(scriptPrompt)
    return true
  }

  if (card.kind === 'skill') {
    const usageExample = getSkillUsageExample(card)
    if (!usageExample) {
      onlyErrorToast(-1, $t('Skill 使用示例为空'))
      return false
    }

    const skillReference = serializeAgentSkillReference(
      card.title,
      serializeTemplateRef('official', card.id),
    )
    updatePromptAndFocus(`${skillReference} ${usageExample}`)
    return true
  }

  if (resolvingTemplateId.value !== undefined)
    return false

  resolvingTemplateId.value = card.id
  try {
    const resolved = await ensureRecommendedTemplate(card)
    if (!resolved)
      return false

    if (resolved.acquired)
      markTemplateRead(resolved.template)

    const templatePrompt = userTemplateToPrompt(resolved.template)
    if (!templatePrompt)
      throw new Error($t('模板提示词为空'))
    prompt.value = templatePrompt
    return true
  }
  catch (error) {
    console.error('Failed to run recommended template in chat', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载推荐模板失败'))
    return false
  }
  finally {
    resolvingTemplateId.value = undefined
  }
}

function getSelectWindowGuideStorageKey() {
  const userInfo = userStore.userInfo
  const accountId = userInfo.id ?? userInfo.email ?? userInfo.phone
  if (accountId === undefined || accountId === null || accountId === '')
    return ''

  return `${SELECT_WINDOW_GUIDE_STORAGE_PREFIX}${encodeURIComponent(String(accountId))}`
}

function hasShownSelectWindowGuide(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) === '1'
  }
  catch {
    return false
  }
}

function markSelectWindowGuideShown(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, '1')
  }
  catch {
    // The guide can still be used when local storage is unavailable.
  }
}

async function maybeShowTemplateGuide(templateKind: TemplateKind) {
  if (typeof window === 'undefined' || selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value)
    return

  const storageKey = getSelectWindowGuideStorageKey()
  if (!storageKey || hasShownSelectWindowGuide(storageKey))
    return

  await nextTick()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

  const isSkillGuide = templateKind === 'skill'
  const target = isSkillGuide
    ? composerRef.value?.getEmptyInputTokenElement() ?? null
    : composerRef.value?.getEmptyProfileTokenElement() ?? null
  if (!target)
    return

  selectWindowGuideTarget.value = target
  selectWindowGuideLabel.value = isSkillGuide ? $t('点击填写参数') : $t('点击选择窗口')
  selectWindowGuideVisible.value = true
  markSelectWindowGuideShown(storageKey)
}

async function runHomeTemplate(card: TemplateCard) {
  if (await useTemplate(card))
    await maybeShowTemplateGuide(card.kind)
}

function dismissSelectWindowGuide() {
  selectWindowGuideVisible.value = false
  selectWindowGuideTarget.value = null
  selectWindowGuideLabel.value = ''
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
  void maybeShowNewTemplateGuide()
}

function getNewTemplateGuideAccountId() {
  return getAgentConsoleAccountId(userStore.userInfo)
}

async function maybeShowNewTemplateGuide() {
  if (typeof window === 'undefined' || selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return

  const accountId = getNewTemplateGuideAccountId()
  if (!accountId || hasShownNewTemplateGuide(accountId) || !hasNewTemplateGuidePending(accountId))
    return

  await nextTick()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

  if (selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return
  if (hasShownNewTemplateGuide(accountId) || !hasNewTemplateGuidePending(accountId))
    return

  const target = composerRef.value?.getSelectTemplateButtonElement() ?? null
  if (!target)
    return

  newTemplateGuideTarget.value = target
  newTemplateGuideLabel.value = $t('有新模板，试试点击这里使用。')
  newTemplateGuideVisible.value = true
  markNewTemplateGuideShown(accountId)
  clearNewTemplateGuidePending(accountId)
}

function dismissNewTemplateGuide() {
  newTemplateGuideVisible.value = false
  newTemplateGuideTarget.value = null
  newTemplateGuideLabel.value = ''
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
}

async function maybeShowAiBatchCreateGuide() {
  if (typeof window === 'undefined' || !hasPendingAiBatchCreateGuide())
    return
  if (selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return

  const accountId = getNewTemplateGuideAccountId()
  if (!accountId)
    return
  const forced = isAiBatchCreateGuideForced()
  if (!forced && hasShownAiBatchCreateGuide(accountId)) {
    clearPendingAiBatchCreateGuide()
    return
  }

  await nextTick()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

  if (!hasPendingAiBatchCreateGuide())
    return
  if (selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return

  const target = composerRef.value?.getComposerElement() ?? null
  if (!target)
    return

  aiBatchCreateGuideTarget.value = target
  aiBatchCreateGuideLabel.value = $t('支持粘贴/拖入代理信息文件和账号信息文件')
  aiBatchCreateGuideVisible.value = true
  if (!forced)
    markAiBatchCreateGuideShown(accountId)
  clearPendingAiBatchCreateGuide()
}

function dismissAiBatchCreateGuide() {
  aiBatchCreateGuideVisible.value = false
  aiBatchCreateGuideTarget.value = null
  aiBatchCreateGuideLabel.value = ''
  void maybeShowCreateAutomationGuide()
  void maybeShowNewTemplateGuide()
}

async function maybeShowCreateAutomationGuide() {
  if (typeof window === 'undefined' || !hasPendingCreateAutomationGuide())
    return
  if (selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return

  const accountId = getNewTemplateGuideAccountId()
  if (!accountId)
    return
  if (hasShownCreateAutomationGuide(accountId)) {
    clearPendingCreateAutomationGuide()
    return
  }

  await nextTick()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

  if (!hasPendingCreateAutomationGuide())
    return
  if (selectWindowGuideVisible.value || aiBatchCreateGuideVisible.value || createAutomationGuideVisible.value || newTemplateGuideVisible.value)
    return

  const target = composerRef.value?.getSelectTemplateButtonElement() ?? null
  if (!target)
    return

  createAutomationGuideTarget.value = target
  createAutomationGuideLabel.value = $t('点击选择要执行的自动化模板')
  createAutomationGuideVisible.value = true
  markCreateAutomationGuideShown(accountId)
  clearPendingCreateAutomationGuide()
}

function dismissCreateAutomationGuide() {
  createAutomationGuideVisible.value = false
  createAutomationGuideTarget.value = null
  createAutomationGuideLabel.value = ''
  void maybeShowAiBatchCreateGuide()
  void maybeShowNewTemplateGuide()
}

function handleCreateAutomationGuideRequest() {
  void maybeShowCreateAutomationGuide()
}

function handleAiBatchCreateGuideRequest() {
  void maybeShowAiBatchCreateGuide()
}

function handleNewTemplateCreated() {
  void maybeShowNewTemplateGuide()
}

function dismissAllGuides() {
  selectWindowGuideVisible.value = false
  selectWindowGuideTarget.value = null
  selectWindowGuideLabel.value = ''
  aiBatchCreateGuideVisible.value = false
  aiBatchCreateGuideTarget.value = null
  aiBatchCreateGuideLabel.value = ''
  createAutomationGuideVisible.value = false
  createAutomationGuideTarget.value = null
  createAutomationGuideLabel.value = ''
  newTemplateGuideVisible.value = false
  newTemplateGuideTarget.value = null
  newTemplateGuideLabel.value = ''
}

function openOnboarding() {
  dismissAllGuides()
  onboardingSessionKey.value += 1
  onboardingVisible.value = true
}

async function findOfficialScriptTemplate(slug: OnboardingScriptTemplateSlug) {
  const response = await agentApi.templates.listOfficialTemplates({
    limit: 20,
    search: slug,
    templateType: 'script',
  })
  const templates = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))
  return templates.find(template => template.slug === slug)
}

async function showOnboardingWindowGuide(target: 'button' | 'token') {
  await nextTick()
  await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  const element = target === 'button'
    ? composerRef.value?.getSelectWindowButtonElement() ?? null
    : composerRef.value?.getEmptyProfileTokenElement() ?? null
  if (!element)
    return

  selectWindowGuideTarget.value = element
  selectWindowGuideLabel.value = $t('点击选择窗口')
  selectWindowGuideVisible.value = true
}

async function fillOnboardingScriptPrompt(slug: OnboardingScriptTemplateSlug) {
  try {
    const template = await findOfficialScriptTemplate(slug)
    if (!template)
      throw new Error($t('官方模板不存在或已下架'))

    updatePromptAndFocus(scriptTemplateToRunPrompt(
      mapTemplateStoreItem(template, localeStore.currentLocale).title,
      serializeTemplateRef('official', template.id),
    ))
    await showOnboardingWindowGuide('token')
  }
  catch (error) {
    console.error(`[agent-console] Failed to prepare onboarding template: ${slug}`, error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载官方模板失败'))
  }
}

async function handleOnboardingExperience(scenario: 'create' | 'publish' | 'nurture' | 'analytics') {
  if (!onboardingVisible.value)
    return

  onboardingVisible.value = false

  if (scenario === 'create') {
    try {
      const response = await agentApi.templates.listOfficialTemplates({
        limit: 20,
        search: AI_BATCH_CREATE_TEMPLATE_SLUG,
        templateType: 'prompt',
      })
      const templates = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))
      const templatePrompt = pickAiBatchCreatePrompt(templates, localeStore.currentLocale)
      if (!templatePrompt)
        throw new Error($t('未找到批量创建窗口模板'))

      updatePromptAndFocus(templatePrompt)
      requestAiBatchCreateGuide(true)
    }
    catch (error) {
      console.error('[agent-console] Failed to prepare onboarding batch-create template', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载官方模板失败'))
    }
    return
  }

  if (scenario === 'publish') {
    updatePromptAndFocus($t('在 {profile} 窗口中运行 {script}', {
      profile: serializeAgentProfileReference([]),
      script: $t("发布视频"),
    }))
    await showOnboardingWindowGuide('token')
    return
  }

  await fillOnboardingScriptPrompt(ONBOARDING_SCRIPT_TEMPLATE_SLUGS[scenario])
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).some(type => type === 'Files')
}

function getPathBaseName(value: string) {
  return value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}

function getFileLocalPath(file: File) {
  if (!globalThis.isElectron)
    return ''

  try {
    return globalThis.electronAPI.getPathForFile(file) || ''
  }
  catch (error) {
    console.error('[agent-console] Failed to get dropped file path:', error)
    return ''
  }
}

function getDirectoryPathFromChildFile(filePath: string, relativePath: string, rootName: string) {
  const normalizedFilePath = normalizePath(filePath)
  const relativeParts = normalizePath(relativePath).split('/').filter(Boolean)
  const rootIndex = relativeParts[0] === rootName ? 1 : 0
  const childPathUnderRoot = relativeParts.slice(rootIndex).join('/')

  if (!childPathUnderRoot)
    return filePath

  const suffix = `/${childPathUnderRoot}`
  if (normalizedFilePath.endsWith(suffix))
    return filePath.slice(0, -suffix.length)

  return ''
}

function getDroppedEntry(item: DataTransferItem) {
  return (item as DataTransferItem & {
    webkitGetAsEntry?: () => DroppedFileSystemEntry | null
  }).webkitGetAsEntry?.() ?? null
}

function readDroppedFile(entry: DroppedFileEntry, relativePath?: string) {
  return new Promise<File>((resolve, reject) => {
    entry.file((file) => {
      if (relativePath) {
        Object.defineProperty(file, 'webkitRelativePath', {
          configurable: true,
          value: relativePath,
        })
      }
      resolve(file)
    }, reject)
  })
}

async function readDroppedDirectoryEntries(entry: DroppedDirectoryEntry) {
  const reader = entry.createReader()
  const entries: DroppedFileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<DroppedFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch.length)
      break
    entries.push(...batch)
  }

  return entries
}

async function collectDroppedDirectoryFiles(entry: DroppedDirectoryEntry, parentPath = entry.name): Promise<File[]> {
  const files: File[] = []
  const entries = await readDroppedDirectoryEntries(entry)

  for (const child of entries) {
    const childPath = `${parentPath}/${child.name}`
    if (child.isFile) {
      files.push(await readDroppedFile(child, childPath))
      continue
    }

    files.push(...await collectDroppedDirectoryFiles(child, childPath))
  }

  return files
}

async function findFirstDroppedDirectoryFile(entry: DroppedDirectoryEntry, parentPath = entry.name): Promise<File | undefined> {
  const entries = await readDroppedDirectoryEntries(entry)

  for (const child of entries) {
    const childPath = `${parentPath}/${child.name}`
    if (child.isFile)
      return readDroppedFile(child, childPath)

    const file = await findFirstDroppedDirectoryFile(child, childPath)
    if (file)
      return file
  }

  return undefined
}

async function addDroppedDirectory(entry: DroppedDirectoryEntry) {
  if (globalThis.isElectron) {
    const firstFile = await findFirstDroppedDirectoryFile(entry)
    const firstFilePath = firstFile ? getFileLocalPath(firstFile) : ''
    const firstRelativePath = firstFile
      ? (firstFile as File & { webkitRelativePath?: string }).webkitRelativePath || `${entry.name}/${firstFile.name}`
      : ''
    const directoryPath = firstFilePath
      ? getDirectoryPathFromChildFile(firstFilePath, firstRelativePath, entry.name)
      : ''

    if (directoryPath) {
      emit('addPathAttachment', {
        kind: 'folder',
        name: entry.name || getPathBaseName(directoryPath),
        path: directoryPath,
      })
      return
    }
  }

  const files = await collectDroppedDirectoryFiles(entry)
  if (!files.length)
    return

  emit('addFolder', { name: entry.name, files })
}

function addDroppedFiles(files: File[]) {
  if (!files.length)
    return

  if (!globalThis.isElectron) {
    emit('addAttachments', files)
    return
  }

  const uploadFallback: File[] = []
  for (const file of files) {
    const path = getFileLocalPath(file)
    if (!path) {
      uploadFallback.push(file)
      continue
    }

    emit('addPathAttachment', {
      kind: 'file',
      name: file.name || getPathBaseName(path),
      path,
    })
  }

  if (uploadFallback.length)
    emit('addAttachments', uploadFallback)
}

async function addDroppedItems(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? [])
  const entries = items
    .map(item => ({ entry: getDroppedEntry(item), item }))
    .filter((value): value is DroppedTransferEntry => Boolean(value.entry))

  if (!entries.length) {
    addDroppedFiles(Array.from(dataTransfer.files ?? []))
    return
  }

  const looseFiles: File[] = []
  for (const { entry, item } of entries) {
    if (entry.isFile) {
      looseFiles.push(await readDroppedFile(entry))
      continue
    }

    const itemFile = item.getAsFile()
    const itemPath = itemFile ? getFileLocalPath(itemFile) : ''
    if (itemPath) {
      emit('addPathAttachment', {
        kind: 'folder',
        name: entry.name || getPathBaseName(itemPath),
        path: itemPath,
      })
      continue
    }

    await addDroppedDirectory(entry)
  }

  addDroppedFiles(looseFiles)
}

function handleWorkspaceDragEnter(event: DragEvent) {
  if (!isFileDrag(event) || props.thinking)
    return

  event.preventDefault()
  dragDepth.value += 1
}

function handleWorkspaceDragOver(event: DragEvent) {
  if (!isFileDrag(event) || props.thinking)
    return

  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'copy'
}

function handleWorkspaceDragLeave(event: DragEvent) {
  if (!isFileDrag(event))
    return

  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

async function handleWorkspaceDrop(event: DragEvent) {
  if (!isFileDrag(event) || props.thinking)
    return

  event.preventDefault()
  dragDepth.value = 0

  if (!event.dataTransfer)
    return

  try {
    await addDroppedItems(event.dataTransfer)
  }
  catch (error) {
    console.error('[agent-console] Failed to add dropped attachments:', error)
  }
}

watch(composerRef, async () => {
  await nextTick()
  composerShellElement.value = composerRef.value?.getShellElement() ?? null
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
  void maybeShowNewTemplateGuide()
}, { flush: 'post', immediate: true })

watch(() => props.activeConversationId, () => {
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
  void maybeShowNewTemplateGuide()
})

watch(() => getNewTemplateGuideAccountId(), () => {
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
})

onMounted(() => {
  perfLog('chat-workspace:mounted')
  window.addEventListener(AI_BATCH_CREATE_GUIDE_EVENT, handleAiBatchCreateGuideRequest)
  window.addEventListener(CREATE_AUTOMATION_GUIDE_EVENT, handleCreateAutomationGuideRequest)
  window.addEventListener(NEW_TEMPLATE_GUIDE_EVENT, handleNewTemplateCreated)
  void loadTemplateCards()
  void loadRecommendedTemplates().catch((error) => {
    console.error('Failed to preload recommended templates', error)
  })
  void maybeShowCreateAutomationGuide()
  void maybeShowAiBatchCreateGuide()
  void maybeShowNewTemplateGuide()
})

onBeforeUnmount(() => {
  window.removeEventListener(AI_BATCH_CREATE_GUIDE_EVENT, handleAiBatchCreateGuideRequest)
  window.removeEventListener(CREATE_AUTOMATION_GUIDE_EVENT, handleCreateAutomationGuideRequest)
  window.removeEventListener(NEW_TEMPLATE_GUIDE_EVENT, handleNewTemplateCreated)
})
</script>

<template>
  <AgentConsolePageLayout
    class="chat-workspace"
    :class="{ 'chat-workspace--home': isHome }"
    padding="0"
    :show-task-monitor-toggle="false"
  >
    <div
      class="chat-container"
      :class="{ 'chat-container--conversation': !isHome, 'chat-container--awaiting-approval': hitlRequest }"
      :style="chatContainerStyle"
      @dragenter="handleWorkspaceDragEnter"
      @dragleave="handleWorkspaceDragLeave"
      @dragover="handleWorkspaceDragOver"
      @drop="handleWorkspaceDrop"
    >
      <header v-if="!isHome" class="chat-header">
        <div class="chat-header__title" :title="displayConversationTitle">
          {{ displayConversationTitle }}
        </div>
        <TaskMonitorToggle :label="$t('窗口监控')" variant="pill" />
      </header>

      <div v-if="isHome" class="chat-home-actions">
        <button
          class="chat-home-onboarding"
          type="button"
          :aria-label="$t('打开新手引导')"
          @click="openOnboarding"
        >
          <span>?</span>
          {{ $t('新手引导') }}
        </button>
        <TaskMonitorToggle
          class="chat-home-monitor"
          :label="$t('窗口监控')"
          variant="pill"
        />
      </div>

      <section v-if="isHome" class="home-scroll-shell">
        <div class="home-scroll">
          <div class="home-hero">
            <div class="home-intro">
              <div class="home-brand-orb">
                <SvgIcon class="home-brand-logo" name="roxy-agent/rx-ic-logo" size="56" />
              </div>

              <div class="home-copy">
                <h1>{{ $t('有什么我能帮你的吗？') }}</h1>
                <p>
                  {{ $t('直接与我聊天，或选择模板一键开始。') }}
                </p>
              </div>
            </div>

            <div v-if="templateCardsLoading" class="template-grid">
              <HomeTemplateCardSkeleton :count="TEMPLATE_CARD_COUNT" />
            </div>

            <div v-else-if="templateCards.length" class="template-grid">
              <article v-for="card in templateCards" :key="card.id" class="template-card">
                <div class="template-card__main">
                  <div
                    class="template-card__icon"
                    aria-hidden="true"
                  >
                    <img v-if="card.imageIcon" :src="card.imageIcon" :alt="card.title">
                    <SvgIcon
                      v-else
                      :name="card.iconName"
                      :size="card.iconSize"
                      :color="card.iconColor"
                    />
                  </div>
                  <div class="template-card__copy">
                    <h2>
                      <OverflowTooltip :content="card.title" placement="top" />
                    </h2>
                    <p>
                      <OverflowTooltip :content="card.description" placement="top" />
                    </p>
                  </div>
                </div>

                <div class="template-card__footer">
                  <div class="template-tags">
                    <span
                      v-for="tag in card.tags"
                      :key="tag.id"
                      class="template-tag"
                      :class="{
                        'template-tag--script': tag.tone === 'script',
                        'template-tag--ai': tag.tone === 'ai',
                      }"
                    >
                      {{ tag.label }}
                    </span>
                  </div>
                  <button
                    class="template-run"
                    type="button"
                    :disabled="resolvingTemplateId !== undefined"
                    @click="runHomeTemplate(card)"
                  >
                    {{ $t('使用') }}
                  </button>
                </div>
              </article>
            </div>

            <RouterLink v-slot="{ href, navigate }" custom :to="{ name: 'agent-console-template-store' }">
              <a class="more-templates" :href="href" @click="navigate">
                <SvgIcon name="roxy-agent/rx-ic-templates-store" size="18" />
                <span>{{ $t('更多模板') }}</span>
              </a>
            </RouterLink>
          </div>
        </div>
      </section>

      <ChatMessageList
        v-else
        :active-conversation-id="activeConversationId"
        has-header
        :messages="messages"
        @add-to-chat="addSelectionToCurrentChat"
        @save-as-prompt="openSaveAsPromptDialog"
      />
      <div class="composer-scroll-mask" aria-hidden="true" />
      <div v-if="hitlRequest" class="hitl-overlay" aria-hidden="true" />
      <ChatComposer
        ref="composerRef"
        v-model="prompt"
        auto-focus
        :content-key="activeConversationId ?? 'home'"
        :focus-key="composerAutoFocusKey"
        :hitl-request="hitlRequest"
        :pending-attachments="pendingAttachments"
        :recommended-template-items="recommendedTemplateItems"
        :show-glow="showComposerGlow"
        :thinking="thinking"
        :todo-progress="todoProgress"
        @add-attachments="emit('addAttachments', $event)"
        @add-folder="emit('addFolder', $event)"
        @add-path-attachment="emit('addPathAttachment', $event)"
        @remove-attachment="emit('removeAttachment', $event)"
        @send="emit('send')"
        @stop="emit('stop')"
        @submit-hitl="emit('submitHitl', $event)"
      />

      <SelectWindowGuide
        :label="selectWindowGuideLabel"
        :target="selectWindowGuideTarget"
        :visible="selectWindowGuideVisible"
        @dismiss="dismissSelectWindowGuide"
      />

      <SelectWindowGuide
        :label="aiBatchCreateGuideLabel"
        :target="aiBatchCreateGuideTarget"
        :visible="aiBatchCreateGuideVisible"
        @dismiss="dismissAiBatchCreateGuide"
      />

      <SelectWindowGuide
        callout-above-container
        :label="createAutomationGuideLabel"
        :target="createAutomationGuideTarget"
        :visible="createAutomationGuideVisible"
        @dismiss="dismissCreateAutomationGuide"
      />

      <SelectWindowGuide
        :label="newTemplateGuideLabel"
        :target="newTemplateGuideTarget"
        :visible="newTemplateGuideVisible"
        @dismiss="dismissNewTemplateGuide"
      />

      <AgentOnboarding
        :session-key="onboardingSessionKey"
        :visible="onboardingVisible"
        @close="onboardingVisible = false"
        @experience="handleOnboardingExperience"
      />

      <div v-if="isDraggingFiles" class="chat-drop-overlay" aria-hidden="true" />
      <div v-if="isDraggingFiles" class="chat-drop-label" aria-hidden="true">
        {{ $t('拖动上传') }}
      </div>
    </div>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.chat-container {
  --agent-chat-content-width: min(800px, calc(100% - 68px));

  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  isolation: isolate;
}

.chat-home-actions {
  position: absolute;
  top: 18px;
  right: 28px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-home-actions :deep(.task-monitor-toggle.chat-home-monitor) {
  position: static;
}

.chat-home-onboarding {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 7px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }

  > span {
    display: grid;
    width: 18px;
    height: 18px;
    border: 1.5px solid #6172f3;
    border-radius: 50%;
    color: #6172f3;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    place-items: center;
  }
}

.chat-container--awaiting-approval :deep(.composer-shell) {
  z-index: 8;
}

.hitl-overlay {
  position: absolute;
  inset: 0;
  z-index: 7;
  background: var(--color-bg-overlay);
}

.chat-header {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 6;
  display: flex;
  height: 70px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
}

.chat-header__title {
  min-width: 0;
  max-width: min(430px, calc(100% - 180px));
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header :deep(.task-monitor-toggle) {
  position: static;
  flex: 0 0 auto;
}

.chat-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 7;
  border-radius: inherit;
  background: rgba(46, 144, 250, 0.1);
  pointer-events: none;
}

.chat-drop-label {
  position: absolute;
  top: calc(50% + 36px);
  left: 50%;
  z-index: 8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 10px;
  transform: translate(-50%, -50%);
  border-radius: 10px;
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  pointer-events: none;
  white-space: nowrap;
}

.composer-scroll-mask {
  position: absolute;
  right: 10px;
  bottom: 0;
  left: 0;
  z-index: 3;
  height: calc(var(--agent-composer-reserved-bottom) + 28px);
  background: var(--color-bg-primary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  mask-image: linear-gradient(to bottom, transparent 0, transparent 18%, #0000001f 40%, #00000080 68%, #000 100%);
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 18%,
    #0000001f 40%,
    #00000080 68%,
    #000 100%
  );
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  pointer-events: none;
}

.home-scroll-shell {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  min-height: 0;
  width: 100%;
}

.home-scroll {
  display: block;
  width: 100%;
  height: 98%;
  overflow: auto;
  padding-bottom: calc(var(--agent-composer-reserved-bottom) + 28px);
  box-sizing: border-box;
  scrollbar-gutter: stable;
  mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - var(--agent-composer-reserved-bottom) - 72px),
    #000000e0 calc(100% - var(--agent-composer-reserved-bottom) - 48px),
    #00000085 calc(100% - var(--agent-composer-reserved-bottom) - 20px),
    #0000002e calc(100% - var(--agent-composer-reserved-bottom)),
    transparent calc(100% - var(--agent-composer-reserved-bottom) + 24px),
    transparent 100%
  );
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - var(--agent-composer-reserved-bottom) - 72px),
    #000000e0 calc(100% - var(--agent-composer-reserved-bottom) - 48px),
    #00000085 calc(100% - var(--agent-composer-reserved-bottom) - 20px),
    #0000002e calc(100% - var(--agent-composer-reserved-bottom)),
    transparent calc(100% - var(--agent-composer-reserved-bottom) + 24px),
    transparent 100%
  );
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
}

.home-hero {
  position: relative;
  display: flex;
  width: var(--agent-chat-content-width, min(800px, calc(100% - 68px)));
  margin: 0 auto;
  padding: 58px 0 32px;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  box-sizing: border-box;
}

.home-task-cursor {
  position: absolute;
  top: 1px;
  right: 23px;
  z-index: 9;
  color: var(--color-text-primary);
  pointer-events: none;
}

.home-intro {
  display: flex;
  width: min(740px, 100%);
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-bottom: 16px;
}

.home-brand-orb {
  display: grid;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  place-items: center;
  border-radius: 999px;
}

.home-brand-logo {
  display: block;
  width: 56px;
  height: 56px;
}

.home-copy {
  display: flex;
  width: min(740px, 100%);
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.home-copy h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-family: Archivo, Inter, system-ui, sans-serif;
  font-size: 36px;
  font-weight: 700;
  line-height: 44px;
}

.home-copy p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
}

.template-grid {
  display: grid;
  width: 100%;
  flex: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.template-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 13px 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.template-card:hover {
  border-color: var(--color-border-secondary-hover);
  background: var(--color-bg-primary-hover);
}

.template-card__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.template-card__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  color: var(--color-text-primary);
  border-radius: 10px;
  background: var(--color-bg-tertiary);

  img {
    display: block;
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
}

.template-card__copy {
  min-width: 0;
  flex: 1;
}

.template-card__copy h2 {
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__copy p {
  margin: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.template-tags {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  overflow: hidden;
}

.template-tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 6px;
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.template-tag--script,
.template-tag--ai {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  -webkit-text-fill-color: currentColor;
}

.template-run {
  display: inline-flex;
  height: 24px;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border: 1px solid #ee46bc;
  border-radius: 999px;
  color: #ee46bc;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

:global(body.agent-console-window) {
  --template-run-hover-bg: #fce7f6;
}

:global(html[data-theme='dark'] body.agent-console-window),
:global(html.app-dark body.agent-console-window) {
  --template-run-hover-bg: #300f27;
}

.template-run:hover {
  background: var(--template-run-hover-bg);
}

.more-templates {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 2px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  white-space: nowrap;
}

.more-templates:hover {
  border-color: var(--color-border-secondary-hover);
  background: var(--color-bg-primary-hover);
}

@media (max-width: 980px) {
  .home-copy h1 {
    font-size: 30px;
    line-height: 38px;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }

  .home-task-cursor {
    display: none;
  }
}

@media (max-width: 760px) {
  .chat-container {
    --agent-chat-content-width: min(800px, calc(100% - 32px));
  }
}
</style>
