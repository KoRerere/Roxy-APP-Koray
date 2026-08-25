import type { Ref } from 'vue'
import Mention from '@tiptap/extension-mention'
import StarterKit from '@tiptap/starter-kit'
import { useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import {
  ensureAgentProfileLabelsForPrompt,
  getAgentProfileIdsFromPrompt,
} from '../../profile-token-display'
import { fetchTaskWindowOptionsByDirIds } from '../../task-window-options'
import { AgentToken, ComposerLink, createSlashCommandExtension, getAgentTokenIconName } from './extensions'
import { readProjectSelection, writeProjectSelection } from './projectSelectionCache'
import {
  composerItemToNode,
  getProfileDirIds,
  hasComposerProtocolTokens,
  parsePromptString,
  resolveProfileSelectionItem,
  searchComposerItems,
  serializePromptDoc,
  templateItemToInsertionPrompt,
  tokenToProtocol,
  updateInputTokenValue,
} from './protocol'
import {
  getComposerSelectionBehavior,
  getNextSuggestionIndex,
  getPromptTokenTargets,
  shouldAppendComposerItemSpace,
} from './selection'
import type { SuggestionNavigationDirection } from './selection'
import {
  getAgentSkillInstalledRoot,
  mapUserTemplateComposerItem,
  mergeTemplateComposerItems,
  setAgentSkillInstalledRoot,
} from './templateItems'
import type { AgentComposerItem, AgentComposerProjectOption, AgentComposerSuggestionKind, AgentComposerSuggestionState } from './types'
import { fetchAgentComposerWindowsPage, fetchAllAgentComposerWindows } from './windowItems'
import { useAgentConsoleApi } from '../../api'
import type { UserTemplateDTO } from '../../my-templates'
import { readUserTemplatePage } from '../../my-templates'
import {
  isTemplateUnread,
  markTemplateDrawerRead,
  readUnreadTemplateDrawerKeys,
} from '../../template-unread'

const USER_TEMPLATE_PAGE_SIZE = 200
const PROFILE_SEARCH_DEBOUNCE_MS = 250
const ALL_PROJECTS_VALUE = '__all__'

export function useAgentComposer(options: {
  model: Ref<string>
  editable?: Readonly<Ref<boolean>>
  contentKey?: Readonly<Ref<number | string | undefined>>
  onChooseItem?: (item: AgentComposerItem) => boolean | AgentComposerItem | Promise<boolean | AgentComposerItem>
  onSend: () => void
  recommendedSlashItems?: Readonly<Ref<AgentComposerItem[]>>
  submitOnEnter?: boolean
}) {
  const agentApi = useAgentConsoleApi()
  const workspaceStore = useWorkspaceStore()
  const profileItems = ref<AgentComposerItem[]>([])
  const profileItemCache = new Map<string, AgentComposerItem>()
  const projectOptions = ref<AgentComposerProjectOption[]>([{ label: $t('全部项目'), value: ALL_PROJECTS_VALUE }])
  const selectedProjectId = ref(
    readProjectSelection(workspaceStore.currentWorkspace?.id) ?? ALL_PROJECTS_VALUE,
  )
  const userSlashItems = ref<AgentComposerItem[]>([])
  const unreadTemplateDrawerKeys = ref(readUnreadTemplateDrawerKeys())
  const slashItems = computed(() => mergeTemplateComposerItems(
    options.recommendedSlashItems?.value ?? [],
    userSlashItems.value,
  ).map(item => ({
    ...item,
    unread: isComposerTemplateUnread(unreadTemplateDrawerKeys.value, item),
  })))
  const loaded = reactive({ profile: false, slash: false })
  const preserveMentionSuggestion = ref(false)
  const pendingMentionIds = ref<Set<string>>(new Set())
  const profileQuery = ref('')
  const profilePageIndex = ref(0)
  const profileHasMore = ref(false)
  const profileLoadingMore = ref(false)
  const profileReloading = ref(false)
  const profileLoadError = ref('')
  const profileLoadErrorAction = ref<'page' | 'selectAll'>('page')
  const profileSelectingAll = ref(false)
  const completeProfileItems = ref<AgentComposerItem[] | undefined>()
  const inputEditor = reactive({
    open: false,
    kind: 'input' as 'input' | 'textarea' | 'url',
    label: '',
    value: '',
    nodePos: 0,
    nodeSize: 0,
    anchorEl: null as HTMLElement | null,
  })
  let profileRequestSequence = 0
  let profileSearchTimer: number | undefined
  let selectionScrollFrame = 0
  let slashItemsPromise: Promise<void> | undefined
  let projectOptionsPromise: Promise<void> | undefined
  let promptRenderSequence = 0

  const suggestion = reactive<AgentComposerSuggestionState>({
    open: false,
    loading: false,
    kind: 'mention',
    trigger: '@',
    query: '',
    activeIndex: 0,
    items: [],
  })

  void loadProfiles()
  void loadProjectOptions()

  const initialPrompt = options.model.value
  const editor = useEditor({
    autofocus: false,
    editable: options.editable?.value ?? true,
    content: getAgentProfileIdsFromPrompt(initialPrompt).length
      ? ''
      : parsePromptString(initialPrompt, {
          profiles: profileItems.value,
          slashItems: slashItems.value,
        }),
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      ComposerLink,
      AgentToken,
      Mention.configure({
        HTMLAttributes: {
          class: 'agent-token agent-token--profile',
        },
        renderText({ node }) {
          return tokenToProtocol({
            id: node.attrs.id,
            kind: 'profile',
            title: node.attrs.label || node.attrs.id,
            label: node.attrs.label || node.attrs.id,
            description: node.attrs.description || '',
            iconName: node.attrs.iconName || 'base/rx_ic_at',
            group: 'Windows',
            payload: { dirId: node.attrs.id },
          })
        },
        renderHTML({ node, options }) {
          const iconName = node.attrs.iconName || getAgentTokenIconName('profile')

          return [
            'span',
            mergeMentionAttrs(options.HTMLAttributes, {
              'data-agent-token': 'profile',
              'data-id': node.attrs.id,
              'data-kind': 'profile',
              'data-description': node.attrs.description || '',
              'data-icon-name': node.attrs.iconName || 'base/rx_ic_at',
            }),
            [
              'span',
              { class: 'agent-token__icon' },
              [
                'roxy-svg-icon',
                {
                  name: iconName,
                  fallback: getAgentTokenIconName('profile'),
                  size: 16,
                },
              ],
            ],
            ['span', { class: 'agent-token__label' }, node.attrs.label || node.attrs.id],
            [
              'span',
              {
                'aria-label': 'Remove token',
                'contenteditable': 'false',
                'data-agent-token-remove': '',
                'role': 'button',
                'class': 'agent-token__remove',
              },
              [
                'roxy-svg-icon',
                {
                  name: 'base/rx_ic_delete',
                  size: 12,
                },
              ],
            ],
          ]
        },
        suggestion: {
          char: '@',
          items: async ({ query }) => {
            await loadProfiles(query)
            return profileItems.value
          },
          command: ({ editor, range, props }) => {
            insertComposerItem(editor, props as AgentComposerItem, range)
          },
          render: createSuggestionRenderer('mention'),
        },
      }),
      createSlashCommandExtension({
        getItems: async (query) => {
          await loadSlashItems()

          return searchComposerItems(slashItems.value, query)
        },
        command: ({ editor, range, item }) => insertComposerItem(editor, item, range),
        render: createSuggestionRenderer('slash'),
      }),
    ],
    editorProps: {
      attributes: {
        'class': 'agent-composer-editor',
        'aria-label': 'Roxy AI Agent prompt composer',
      },
      handleKeyDown(_view, event) {
        if (options.editable?.value === false || options.submitOnEnter === false) {
          return false
        }

        if (event.key !== 'Enter') {
          return false
        }

        if (suggestion.open) {
          return false
        }

        if (event.isComposing || event.keyCode === 229) {
          return false
        }

        if (event.shiftKey) {
          return false
        }

        if (!event.altKey) {
          event.preventDefault()
          options.onSend()
          return true
        }

        return false
      },
      handlePaste(_view, event) {
        if (options.editable?.value === false) {
          return false
        }

        const text = event.clipboardData?.getData('text/plain') ?? ''

        if (!hasComposerProtocolTokens(text)) {
          return false
        }

        const content = promptTextToInsertContent(text, {
          profiles: profileItems.value,
          slashItems: slashItems.value,
        })

        if (!content.length) {
          return false
        }

        event.preventDefault()
        closeSuggestion()
        editor.value?.chain().focus().insertContent(content).run()
        return true
      },
      handleClickOn(_view, _pos, node, nodePos, event, direct) {
        if (options.editable?.value === false) {
          return false
        }

        if (!direct || (node.type.name !== 'mention' && node.type.name !== 'agentToken')) {
          return false
        }

        const target = event.target as HTMLElement | null
        if (target?.closest('[data-agent-token-remove]')) {
          event.preventDefault()
          event.stopPropagation()
          closeSuggestion()
          deleteTokenNode(_view, nodePos, node.nodeSize)
          return true
        }

        if (node.type.name === 'agentToken' && (node.attrs.kind === 'input' || node.attrs.kind === 'textarea' || node.attrs.kind === 'url')) {
          event.preventDefault()
          openInputTokenEditor(node, nodePos, target?.closest('.agent-token, .mention') as HTMLElement | null)
          return true
        }

        if (node.type.name === 'agentToken' && node.attrs.kind !== 'profile') {
          return false
        }

        event.preventDefault()
        void openTokenPicker(node, nodePos)
        return true
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement | null

        if (suggestion.open && !target?.closest('.agent-token, .mention')) {
          dismissSuggestion()
        }

        return false
      },
    },
    onUpdate: ({ editor }) => {
      const nextValue = serializePromptDoc(editor.getJSON())

      if (options.model.value !== nextValue) {
        options.model.value = nextValue
      }

      scheduleSelectionScroll(editor)
    },
    onSelectionUpdate: ({ editor }) => scheduleSelectionScroll(editor),
  })

  const canSubmit = computed(() => Boolean(options.model.value.trim()))
  const isEmpty = computed(() => !options.model.value.trim())

  watch(editor, (activeEditor) => {
    if (!activeEditor) {
      return
    }

    const value = options.model.value
    const currentValue = serializePromptDoc(activeEditor.getJSON())
    if (currentValue !== value) {
      void renderPromptAfterProfileLabelsLoad(value)
    }
  }, { immediate: true })

  watch(
    () => [options.model.value, options.contentKey?.value] as const,
    ([value, contentKey], previous) => {
      if (!editor.value) {
        return
      }

      const currentValue = serializePromptDoc(editor.value.getJSON())
      const contentKeyChanged = contentKey !== previous?.[1]
      if (!contentKeyChanged && currentValue === value) {
        return
      }

      void renderPromptAfterProfileLabelsLoad(value)
    },
  )

  async function renderPromptAfterProfileLabelsLoad(value: string) {
    const renderSequence = ++promptRenderSequence

    try {
      await ensureAgentProfileLabelsForPrompt(value, async (ids) => {
        const windows = await fetchTaskWindowOptionsByDirIds(
          ids,
          workspaceStore.currentWorkspace?.workspaceName,
        )
        return windows.map(window => ({
          id: window.id,
          label: window.code || window.name || window.id,
        }))
      })
    }
    catch (error) {
      console.error('Failed to load Agent composer profile labels:', error)
      return
    }

    if (
      renderSequence !== promptRenderSequence
      || options.model.value !== value
      || !editor.value
    ) {
      return
    }

    editor.value.commands.setContent(
      parsePromptString(value, {
        profiles: profileItems.value,
        slashItems: slashItems.value,
      }),
      { emitUpdate: false },
    )
  }

  watch(
    () => options.editable?.value,
    (editable) => {
      editor.value?.setEditable(editable !== false)
      if (editable === false) {
        closeSuggestion()
        cancelInputTokenEdit()
      }
    },
  )

  function createSuggestionRenderer(kind: AgentComposerSuggestionKind) {
    return () => ({
      onStart: (props: any) => {
        suggestion.activeIndex = 0
        syncSuggestionPosition(props, kind)
      },
      onUpdate: (props: any) => syncSuggestionPosition(props, kind),
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (!suggestion.open) {
          return false
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          navigateSuggestion('next')
          return true
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          navigateSuggestion('previous')
          return true
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          chooseItem(suggestion.items[suggestion.activeIndex])
          return true
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          closeSuggestion()
          return true
        }

        return false
      },
      onExit: handleSuggestionExit,
    })
  }

  function syncSuggestionPosition(props: any, kind: AgentComposerSuggestionKind) {
    const items = props.items ?? []
    const shouldResetMentionDraft = kind === 'mention' && (!suggestion.open || suggestion.kind !== 'mention')

    suggestion.open = true
    suggestion.loading = Boolean(props.loading)
    suggestion.kind = kind
    suggestion.trigger = kind === 'mention' ? '@' : '/'
    suggestion.query = props.query ?? ''
    suggestion.items = items
    suggestion.command = props.command
    suggestion.range = props.range
    suggestion.activeIndex = Math.min(suggestion.activeIndex, Math.max(items.length - 1, 0))

    if (shouldResetMentionDraft) {
      resetPendingMentionIds()
    }
  }

  function openAnchoredSuggestion(next: {
    kind: AgentComposerSuggestionKind
    items: AgentComposerItem[]
    command: (item: AgentComposerItem) => void
    query?: string
    activeId?: string
    loading?: boolean
    range?: { from: number, to: number }
  }) {
    const activeIndex = next.activeId
      ? next.items.findIndex(item => item.id === next.activeId)
      : -1

    suggestion.open = true
    suggestion.loading = Boolean(next.loading)
    suggestion.kind = next.kind
    suggestion.trigger = next.kind === 'mention' ? '@' : '/'
    suggestion.query = next.query ?? ''
    suggestion.items = next.items
    suggestion.command = next.command
    suggestion.range = next.range
    suggestion.activeIndex = Math.max(activeIndex, 0)

    if (next.kind === 'mention') {
      resetPendingMentionIds()
    }
  }

  function handleSuggestionExit() {
    if (preserveMentionSuggestion.value && suggestion.kind === 'mention') {
      return
    }

    closeSuggestion()
  }

  function closeSuggestion() {
    clearProfileSearchTimer()
    suggestion.open = false
    suggestion.loading = false
    suggestion.items = []
    suggestion.command = undefined
    suggestion.range = undefined
    suggestion.activeIndex = 0
  }

  function dismissSuggestion() {
    const activeEditor = editor.value

    if (!activeEditor || typeof KeyboardEvent === 'undefined') {
      closeSuggestion()
      return
    }

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    // Reuse Tiptap Suggestion's native Escape path so the current trigger range stays dismissed.
    const handled = activeEditor.view.someProp('handleKeyDown', handler => handler(activeEditor.view, event))

    if (!handled) {
      closeSuggestion()
    }
  }

  function openInputTokenEditor(node: any, nodePos: number, anchorEl?: HTMLElement | null) {
    closeSuggestion()
    inputEditor.open = true
    inputEditor.kind = node.attrs.kind === 'url' ? 'url' : node.attrs.kind === 'textarea' ? 'textarea' : 'input'
    inputEditor.label = node.attrs.title || node.attrs.label || node.attrs.id
    inputEditor.value = node.attrs.payload?.value || ''
    inputEditor.nodePos = nodePos
    inputEditor.nodeSize = node.nodeSize
    inputEditor.anchorEl = anchorEl ?? null
  }

  function cancelInputTokenEdit() {
    inputEditor.open = false
    inputEditor.anchorEl = null
  }

  function confirmInputTokenEdit(value: string) {
    const activeEditor = editor.value

    if (!activeEditor || !inputEditor.open) {
      return
    }

    const updatedDoc = updateInputTokenValue(activeEditor.getJSON(), inputEditor.label, value.trim(), inputEditor.kind)
    activeEditor.commands.setContent(updatedDoc ?? activeEditor.getJSON())
    activeEditor.view.focus()
    inputEditor.open = false
    inputEditor.anchorEl = null
  }

  function markSuggestionItemRead(item: AgentComposerItem) {
    if (suggestion.kind !== 'slash' || !item.unread) {
      return
    }

    const identity = readComposerTemplateIdentity(item)
    if (identity) {
      unreadTemplateDrawerKeys.value = markTemplateDrawerRead(identity)
    }
  }

  function chooseItem(item?: AgentComposerItem) {
    if (!item || !suggestion.command) {
      return
    }

    markSuggestionItemRead(item)
    const behavior = getComposerSelectionBehavior(suggestion.kind)

    if (behavior.multiSelect) {
      toggleMentionItem(item)
      return
    }

    const command = suggestion.command
    command(item)

    if (behavior.closeAfterChoose) {
      closeSuggestion()
    }
  }

  function navigateSuggestion(direction: SuggestionNavigationDirection) {
    suggestion.activeIndex = getNextSuggestionIndex(
      suggestion.activeIndex,
      suggestion.items.length,
      direction,
    )
  }

  async function selectToolbar(trigger: '@' | '/') {
    const kind: AgentComposerSuggestionKind = trigger === '@' ? 'mention' : 'slash'
    const command = (item: AgentComposerItem) => insertComposerItem(editor.value, item)

    if (kind === 'slash' && !loaded.slash) {
      openAnchoredSuggestion({
        kind,
        items: slashItems.value,
        command,
        loading: true,
      })

      await loadSlashItems()

      if (!suggestion.open || suggestion.kind !== kind || suggestion.command !== command) {
        return
      }

      openAnchoredSuggestion({
        kind,
        items: slashItems.value,
        command,
      })
      return
    }

    const items = await ensureItems(kind)

    openAnchoredSuggestion({
      kind,
      items,
      command,
    })
  }

  async function updateSuggestionQuery(query: string) {
    suggestion.query = query
    suggestion.activeIndex = 0

    if (suggestion.kind === 'mention') {
      scheduleProfileSearch(query)
      return
    }

    suggestion.items = searchComposerItems(slashItems.value, query)
  }

  function clearProfileSearchTimer() {
    if (!profileSearchTimer) {
      return
    }

    window.clearTimeout(profileSearchTimer)
    profileSearchTimer = undefined
  }

  function scheduleProfileSearch(query: string) {
    clearProfileSearchTimer()

    const normalizedQuery = query.trim()
    if (normalizedQuery === profileQuery.value) {
      suggestion.items = profileItems.value
      return
    }

    profileSearchTimer = window.setTimeout(() => {
      profileSearchTimer = undefined
      void loadProfiles(query, { showSuggestionLoading: false }).then(() => {
        if (!suggestion.open || suggestion.kind !== 'mention') {
          return
        }

        if (suggestion.query.trim() !== normalizedQuery) {
          return
        }

        suggestion.items = profileItems.value
      })
    }, PROFILE_SEARCH_DEBOUNCE_MS)
  }

  async function loadProjectOptions() {
    if (projectOptionsPromise) {
      return projectOptionsPromise
    }

    const request = (async () => {
      try {
        const response = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
        if (response.code !== 0) {
          throw new Error(response.msg || 'Failed to load projects')
        }

        const seen = new Set<string>()
        projectOptions.value = [
          { label: $t('全部项目'), value: ALL_PROJECTS_VALUE },
          ...(response.data?.rows ?? [])
            .flatMap((item) => {
              const value = item.project_id?.toString()
              if (!value || seen.has(value)) {
                return []
              }

              seen.add(value)
              return [{
                label: item.projectName || (item.projectDefault ? $t('默认项目') : value),
                value,
              }]
            }),
        ]

        if (!projectOptions.value.some(option => option.value === selectedProjectId.value)) {
          resetSelectedProject(true)
        }
      }
      catch (error) {
        console.error('Failed to load agent projects', error)
        projectOptions.value = [{ label: $t('全部项目'), value: ALL_PROJECTS_VALUE }]
        resetSelectedProject(false)
      }
    })()

    projectOptionsPromise = request
    try {
      await request
    }
    finally {
      if (projectOptionsPromise === request) {
        projectOptionsPromise = undefined
      }
    }
  }

  function resetSelectedProject(persist: boolean) {
    if (selectedProjectId.value === ALL_PROJECTS_VALUE) {
      return
    }

    selectedProjectId.value = ALL_PROJECTS_VALUE
    if (persist) {
      writeProjectSelection(workspaceStore.currentWorkspace?.id, ALL_PROJECTS_VALUE)
    }
    void reloadProfilesForSelectedProject()
  }

  async function updateSelectedProject(projectId: string) {
    selectedProjectId.value = projectId
    writeProjectSelection(workspaceStore.currentWorkspace?.id, projectId)
    await reloadProfilesForSelectedProject()
  }

  async function reloadProfilesForSelectedProject() {
    clearProfileSearchTimer()
    suggestion.activeIndex = 0

    await loadProfiles(suggestion.query, { showSuggestionLoading: false })

    if (!suggestion.open || suggestion.kind !== 'mention') {
      return
    }

    suggestion.items = profileItems.value
  }

  function focusEditor(event?: MouseEvent) {
    if (options.editable?.value === false) {
      return
    }

    const target = event?.target as HTMLElement | null

    if (target?.closest('.ProseMirror, button')) {
      return
    }

    editor.value?.chain().focus('end').run()
  }

  function scheduleSelectionScroll(activeEditor: {
    isDestroyed: boolean
    view: {
      hasFocus: () => boolean
      dom: HTMLElement
      state: { selection: { head: number } }
      coordsAtPos: (position: number) => { top: number, bottom: number }
    }
  }) {
    if (typeof window === 'undefined') {
      return
    }

    if (selectionScrollFrame) {
      window.cancelAnimationFrame(selectionScrollFrame)
    }

    selectionScrollFrame = window.requestAnimationFrame(() => {
      selectionScrollFrame = 0

      if (activeEditor.isDestroyed || !activeEditor.view.hasFocus()) {
        return
      }

      const scrollContainer = activeEditor.view.dom
      const containerRect = scrollContainer.getBoundingClientRect()
      const caretRect = activeEditor.view.coordsAtPos(activeEditor.view.state.selection.head)
      const edgePadding = 4

      if (caretRect.bottom > containerRect.bottom - edgePadding) {
        scrollContainer.scrollTop += caretRect.bottom - containerRect.bottom + edgePadding
      }
      else if (caretRect.top < containerRect.top + edgePadding) {
        scrollContainer.scrollTop -= containerRect.top - caretRect.top + edgePadding
      }
    })
  }

  async function openTokenPicker(node: any, nodePos: number) {
    const kind: AgentComposerSuggestionKind = node.type.name === 'mention' || node.attrs.kind === 'profile'
      ? 'mention'
      : 'slash'
    const items = await ensureItems(kind)

    openAnchoredSuggestion({
      kind,
      items,
      activeId: node.attrs.id,
      range: { from: nodePos, to: nodePos + node.nodeSize },
      command: (item) => {
        const activeEditor = editor.value

        if (!activeEditor) {
          return
        }

        const { tr } = activeEditor.view.state
        const replacement = activeEditor.view.state.schema.nodeFromJSON(composerItemToNode(item))

        activeEditor.view.dispatch(tr.replaceWith(nodePos, nodePos + node.nodeSize, replacement))
        activeEditor.view.focus()
      },
    })

    if (kind === 'mention') {
      pendingMentionIds.value = getProfileIdsFromNode(node)
    }
  }

  async function ensureItems(kind: AgentComposerSuggestionKind) {
    if (kind === 'mention') {
      await loadProfiles('', { showSuggestionLoading: false })

      return profileItems.value
    }

    if (!loaded.slash) {
      await loadSlashItems()
    }

    return slashItems.value
  }

  function getSelectedProjectFilter() {
    return selectedProjectId.value === ALL_PROJECTS_VALUE ? '' : selectedProjectId.value
  }

  function cacheProfileItems(items: readonly AgentComposerItem[]) {
    items.forEach(item => profileItemCache.set(item.id, item))
  }

  function mergeProfileItems(items: readonly AgentComposerItem[]) {
    const byId = new Map(profileItems.value.map(item => [item.id, item]))
    items.forEach(item => byId.set(item.id, item))
    return Array.from(byId.values())
  }

  async function loadProfiles(query = '', options: { showSuggestionLoading?: boolean } = {}) {
    const showSuggestionLoading = options.showSuggestionLoading ?? true
    const normalizedQuery = query.trim()
    const requestSequence = ++profileRequestSequence

    profilePageIndex.value = 0
    profileHasMore.value = true
    profileReloading.value = true
    profileLoadingMore.value = false
    profileLoadError.value = ''
    profileLoadErrorAction.value = 'page'
    completeProfileItems.value = undefined

    if (showSuggestionLoading) {
      suggestion.loading = suggestion.kind === 'mention'
    }

    try {
      const page = await fetchAgentComposerWindowsPage({
        pageIndex: 1,
        keyword: normalizedQuery,
        projectId: getSelectedProjectFilter(),
      }, workspaceStore.currentWorkspace?.workspaceName)

      if (requestSequence !== profileRequestSequence) {
        return
      }

      profileItems.value = page.items
      cacheProfileItems(page.items)
      profileQuery.value = normalizedQuery
      profilePageIndex.value = 1
      profileHasMore.value = page.hasMore
      completeProfileItems.value = page.hasMore ? undefined : page.items
      loaded.profile = !normalizedQuery || loaded.profile
    }
    catch (error) {
      if (requestSequence !== profileRequestSequence) {
        return
      }

      console.error('Failed to load agent windows', error)
      profileItems.value = []
      profileQuery.value = normalizedQuery
      profileHasMore.value = false
      profileLoadError.value = error instanceof Error ? error.message : $t('获取窗口信息失败')
      loaded.profile = !normalizedQuery || loaded.profile
    }
    finally {
      if (requestSequence === profileRequestSequence) {
        profileReloading.value = false
        if (showSuggestionLoading) {
          suggestion.loading = false
        }
      }
    }
  }

  async function loadMoreProfiles() {
    if (
      suggestion.kind !== 'mention'
      || suggestion.loading
      || profileReloading.value
      || profileSelectingAll.value
      || profileLoadingMore.value
      || !profileHasMore.value
      || suggestion.query.trim() !== profileQuery.value
    ) {
      return
    }

    const requestSequence = profileRequestSequence
    const nextPageIndex = profilePageIndex.value + 1
    profileLoadingMore.value = true
    profileLoadError.value = ''
    profileLoadErrorAction.value = 'page'

    try {
      const page = await fetchAgentComposerWindowsPage({
        pageIndex: nextPageIndex,
        keyword: profileQuery.value,
        projectId: getSelectedProjectFilter(),
      }, workspaceStore.currentWorkspace?.workspaceName)

      if (requestSequence !== profileRequestSequence) {
        return
      }

      const mergedItems = mergeProfileItems(page.items)
      profileItems.value = mergedItems
      cacheProfileItems(page.items)
      profilePageIndex.value = nextPageIndex
      profileHasMore.value = page.hasMore
      if (!completeProfileItems.value && !page.hasMore) {
        completeProfileItems.value = mergedItems
      }

      if (suggestion.open && suggestion.kind === 'mention') {
        suggestion.items = mergedItems
      }
    }
    catch (error) {
      if (requestSequence !== profileRequestSequence) {
        return
      }

      console.error('Failed to load more agent windows', error)
      profileLoadError.value = error instanceof Error ? error.message : $t('获取窗口信息失败')
    }
    finally {
      if (requestSequence === profileRequestSequence) {
        profileLoadingMore.value = false
      }
    }
  }

  function retryLoadProfiles() {
    if (profileLoadErrorAction.value === 'selectAll') {
      void toggleAllMentionItems()
      return
    }

    if (profilePageIndex.value === 0) {
      void loadProfiles(suggestion.query, { showSuggestionLoading: false }).then(() => {
        if (suggestion.open && suggestion.kind === 'mention') {
          suggestion.items = profileItems.value
        }
      })
      return
    }

    void loadMoreProfiles()
  }

  async function getAllProfileItemsForCurrentFilter() {
    if (profileReloading.value) {
      return undefined
    }

    if (completeProfileItems.value) {
      return completeProfileItems.value
    }

    const requestedQuery = suggestion.query.trim()
    if (requestedQuery !== profileQuery.value) {
      clearProfileSearchTimer()
      await loadProfiles(requestedQuery, { showSuggestionLoading: false })
    }

    const requestSequence = profileRequestSequence
    profileSelectingAll.value = true
    profileLoadError.value = ''
    profileLoadErrorAction.value = 'selectAll'

    try {
      const items = await fetchAllAgentComposerWindows(
        profileQuery.value,
        workspaceStore.currentWorkspace?.workspaceName,
        getSelectedProjectFilter(),
      )

      if (requestSequence !== profileRequestSequence) {
        return undefined
      }

      cacheProfileItems(items)
      completeProfileItems.value = items
      return items
    }
    catch (error) {
      if (requestSequence !== profileRequestSequence) {
        return undefined
      }

      console.error('Failed to load all agent windows', error)
      profileLoadError.value = error instanceof Error ? error.message : $t('获取窗口信息失败')
      return undefined
    }
    finally {
      profileSelectingAll.value = false
    }
  }

  async function loadSlashItems() {
    if (loaded.slash) {
      return
    }

    if (slashItemsPromise) {
      return slashItemsPromise
    }

    const request = (async () => {
      try {
        // await agentApi.initializePresetTemplates()
        if (!getAgentSkillInstalledRoot()) {
          try {
            const info = await agentApi.skillPathInfo()
            setAgentSkillInstalledRoot(info.installedRoot)
          }
          catch (error) {
            console.error('Failed to load Skill installed root', error)
          }
        }

        const rows: UserTemplateDTO[] = []
        let offset = 0
        let total = 0

        do {
          const response = await agentApi.userTemplates.listUserTemplates({
            limit: USER_TEMPLATE_PAGE_SIZE,
            offset,
            sortBy: 'updated_at',
            sortOrder: 'desc',
          })
          const page = readUserTemplatePage(response, '加载用户模板失败')

          rows.push(...page.items)
          total = page.total
          offset += page.items.length

          if (page.items.length === 0) {
            break
          }
        } while (offset < total)

        userSlashItems.value = rows.map(row => mapUserTemplateComposerItem(row))
        loaded.slash = true
      }
      catch (error) {
        console.error('Failed to load user templates', error)
        userSlashItems.value = []
        loaded.slash = true
      }
    })()
    slashItemsPromise = request

    try {
      await request
    }
    finally {
      if (slashItemsPromise === request) {
        slashItemsPromise = undefined
      }
    }
  }

  watch(slashItems, (items) => {
    if (!suggestion.open || suggestion.kind !== 'slash') {
      return
    }

    suggestion.items = searchComposerItems(items, suggestion.query)
    suggestion.activeIndex = Math.min(suggestion.activeIndex, Math.max(0, suggestion.items.length - 1))
  })

  onBeforeUnmount(() => {
    clearProfileSearchTimer()
    if (selectionScrollFrame) {
      window.cancelAnimationFrame(selectionScrollFrame)
    }
    editor.value?.destroy()
  })

  const selectedMentionIds = computed(() => {
    if (suggestion.open && suggestion.kind === 'mention') {
      return pendingMentionIds.value
    }

    return getCommittedMentionIds()
  })

  const selectedMentionCount = computed(() => selectedMentionIds.value.size)

  const allMentionItemsSelected = computed(() => {
    if (!completeProfileItems.value) {
      return false
    }

    const selectableIds = getSelectableMentionIds(completeProfileItems.value)
    return Boolean(selectableIds.length) && selectableIds.every(id => pendingMentionIds.value.has(id))
  })

  function getCommittedMentionIds() {
    return getPromptTokenTargets(options.model.value, 'profile')
  }

  function getSelectableMentionIds(items: readonly AgentComposerItem[] = suggestion.items) {
    return items.flatMap(getProfileDirIds)
  }

  function resetPendingMentionIds() {
    pendingMentionIds.value = new Set(getCommittedMentionIds())
  }

  function toggleMentionItem(item: AgentComposerItem) {
    const nextIds = new Set(pendingMentionIds.value)

    getProfileDirIds(item).forEach((id) => {
      if (nextIds.has(id)) {
        nextIds.delete(id)
      }
      else {
        nextIds.add(id)
      }
    })

    pendingMentionIds.value = nextIds
  }

  async function toggleAllMentionItems() {
    if (profileSelectingAll.value) {
      return
    }

    const items = await getAllProfileItemsForCurrentFilter()
    if (!items) {
      return
    }

    const selectableIds = getSelectableMentionIds(items)
    const nextIds = new Set(pendingMentionIds.value)
    const shouldDeselect = Boolean(selectableIds.length)
      && selectableIds.every(id => nextIds.has(id))

    selectableIds.forEach((id) => {
      if (shouldDeselect) {
        nextIds.delete(id)
      }
      else {
        nextIds.add(id)
      }
    })

    pendingMentionIds.value = nextIds
  }

  function cancelMentionSelection() {
    resetPendingMentionIds()
    dismissSuggestion()
  }

  function confirmMentionSelection() {
    const activeEditor = editor.value

    if (!activeEditor) {
      return
    }

    const selectedItems = Array.from(pendingMentionIds.value).map(id => (
      profileItemCache.get(id)
      ?? profileItems.value.find(item => getProfileDirIds(item).includes(id))
      ?? {
        id,
        kind: 'profile' as const,
        title: id,
        label: id,
        description: '',
        iconName: 'roxy-agent/rx-ic-token-profile',
        group: 'Windows',
        payload: { dirId: id },
      }
    ))

    preserveMentionSuggestion.value = true

    const selectedProfileItem = resolveProfileSelectionItem(selectedItems, Boolean(suggestion.range))

    if (suggestion.range && selectedProfileItem) {
      insertComposerItem(activeEditor, selectedProfileItem, suggestion.range)
    }
    else if (suggestion.range) {
      deleteSuggestionRange(activeEditor, suggestion.range)
    }
    else {
      removeProfileTokens(activeEditor)
    }

    if (!suggestion.range && selectedProfileItem) {
      insertComposerItem(activeEditor, selectedProfileItem)
    }

    suggestion.range = undefined
    closeSuggestion()
    window.setTimeout(() => {
      preserveMentionSuggestion.value = false
    }, 0)
  }

  return {
    allMentionItemsSelected,
    cancelMentionSelection,
    canSubmit,
    chooseItem,
    closeSuggestion,
    confirmMentionSelection,
    confirmInputTokenEdit,
    cancelInputTokenEdit,
    editor,
    focusEditor,
    inputEditor,
    isEmpty,
    markSuggestionItemRead,
    navigateSuggestion,
    profileHasMore,
    profileLoadError,
    profileLoadingMore,
    profileReloading,
    profileSelectingAll,
    projectOptions,
    loadMoreProfiles,
    selectedMentionIds,
    selectedProjectId,
    selectedMentionCount,
    retryLoadProfiles,
    selectToolbar,
    suggestion,
    toggleAllMentionItems,
    updateSelectedProject,
    updateSuggestionQuery,
  }
}

function readComposerTemplateIdentity(item: AgentComposerItem) {
  const id = Number(item.payload.userTemplateId)
  const workspaceId = item.payload.workspaceId?.trim()

  if (!workspaceId || !Number.isSafeInteger(id) || id <= 0) {
    return undefined
  }

  return { id, workspaceId }
}

function isComposerTemplateUnread(keys: ReadonlySet<string>, item: AgentComposerItem) {
  const identity = readComposerTemplateIdentity(item)
  return Boolean(identity && isTemplateUnread(keys, identity))
}

function insertComposerItem(editor: any, item: AgentComposerItem, range?: { from: number, to: number }) {
  if (!editor) {
    return
  }

  if (item.kind === 'template') {
    insertTemplatePrompt(editor, item, range)
    return
  }

  const chain = editor.chain().focus()
  const rangeTarget = range ? editor.state.doc.nodeAt(range.from) : undefined
  const shouldAppendSpace = shouldAppendComposerItemSpace(rangeTarget, range)

  if (range) {
    chain.deleteRange(range)
  }

  chain
    .insertContent([
      composerItemToNode(item),
      ...(shouldAppendSpace ? [{ type: 'text', text: ' ' }] : []),
    ])
    .run()
}

function insertTemplatePrompt(editor: any, item: AgentComposerItem, range?: { from: number, to: number }) {
  const prompt = templateItemToInsertionPrompt(item)

  if (!prompt) {
    return
  }

  const content = parsePromptString(prompt, {
    profiles: [],
    slashItems: item.template?.tokens ?? [],
  }).content ?? []
  const chain = editor.chain().focus()

  if (range) {
    chain.deleteRange(range)
  }

  chain
    .insertContent([
      ...content.flatMap((node: any, index: number) => [
        ...(index > 0 ? [{ type: 'hardBreak' }] : []),
        ...(node.content ?? []),
      ]),
      { type: 'text', text: ' ' },
    ])
    .run()
}

function promptTextToInsertContent(
  text: string,
  options: {
    profiles: AgentComposerItem[]
    slashItems: AgentComposerItem[]
  },
) {
  const doc = parsePromptString(text, options)

  return (doc.content ?? []).flatMap((node: any, index: number) => [
    ...(index > 0 ? [{ type: 'hardBreak' }] : []),
    ...(node.content ?? []),
  ])
}

function deleteSuggestionRange(editor: any, range?: { from: number, to: number }) {
  if (!range) {
    return
  }

  editor.chain().focus().deleteRange(range).run()
}

function deleteTokenNode(view: any, nodePos: number, nodeSize: number) {
  const { doc, tr } = view.state
  const tokenFrom = nodePos
  const tokenTo = nodePos + nodeSize
  let deleteFrom = tokenFrom
  let deleteTo = tokenTo
  const nextChar = doc.textBetween(tokenTo, Math.min(tokenTo + 1, doc.content.size))

  if (nextChar === ' ') {
    deleteTo = tokenTo + 1
  }
  else {
    const prevChar = doc.textBetween(Math.max(tokenFrom - 1, 0), tokenFrom)

    if (prevChar === ' ') {
      deleteFrom = tokenFrom - 1
    }
  }

  view.dispatch(tr.delete(deleteFrom, deleteTo))
  view.focus()
}

function removeProfileTokens(editor: any) {
  const ranges: Array<{ from: number, to: number }> = []

  editor.state.doc.descendants((node: any, pos: number) => {
    if (!isProfileNode(node)) {
      return
    }

    ranges.push({ from: pos, to: pos + node.nodeSize })
  })

  if (!ranges.length) {
    return
  }

  const { tr } = editor.state

  ranges.reverse().forEach((range) => {
    tr.delete(range.from, range.to)
  })

  editor.view.dispatch(tr)
  editor.view.focus()
}

function isProfileNode(node: any) {
  return node.type.name === 'mention'
    || (
      node.type.name === 'agentToken'
      && node.attrs.kind === 'profile'
    )
}

function getProfileIdsFromNode(node: any) {
  if (node.type.name === 'mention') {
    return new Set<string>(node.attrs.id ? [node.attrs.id] : [])
  }

  if (node.type.name === 'agentToken' && node.attrs.kind === 'profile') {
    return new Set<string>(getProfileDirIds(node.attrs))
  }

  return new Set<string>()
}

function mergeMentionAttrs(...sources: Array<Record<string, unknown> | undefined>) {
  return Object.assign({}, ...sources)
}
