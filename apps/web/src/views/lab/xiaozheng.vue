<script setup lang="ts">
import { Extension, mergeAttributes, Node } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import { Suggestion } from '@tiptap/suggestion'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

type TokenKind = 'profile' | 'skill' | 'script'

interface ComposerItem {
  id: string
  kind: TokenKind
  title: string
  label?: string
  description: string
  icon: string
  group: string
  payload: Record<string, string>
}

interface SuggestionState {
  open: boolean
  kind: 'mention' | 'slash'
  trigger: '@' | '/'
  query: string
  activeIndex: number
  items: ComposerItem[]
  command?: (item: ComposerItem) => void
  rect: {
    left: number
    top: number
    width: number
    maxHeight: number
  }
}

const mentionItems: ComposerItem[] = [
  {
    id: 'profile-mou-72',
    kind: 'profile',
    title: 'MOU-72 · dance_daily',
    label: 'MOU-72 · dance_daily',
    description: 'tiktok.com/@dance_daily',
    icon: '🌐',
    group: 'Windows',
    payload: { dirId: 'profile-mou-72' },
  },
  {
    id: 'profile-mou-89',
    kind: 'profile',
    title: 'MOU-89 · store_admin',
    label: 'MOU-89 · store_admin',
    description: 'facebook.com/store_admin',
    icon: '🌐',
    group: 'Windows',
    payload: { dirId: 'profile-mou-89' },
  },
  {
    id: 'profile-mou-90',
    kind: 'profile',
    title: 'MOU-90 · page_ops',
    label: 'MOU-90 · page_ops',
    description: 'instagram.com/page_ops',
    icon: '🌐',
    group: 'Windows',
    payload: { dirId: 'profile-mou-90' },
  },
]

const slashItems: ComposerItem[] = [
  {
    id: 'batch-account-nurturing',
    kind: 'skill',
    title: 'Batch account nurturing',
    description: 'Multi-account concurrent simulation of real person behavior',
    icon: '🧩',
    group: 'Skills',
    payload: { skillMdPath: '/Users/anbin/.roxy/skills/batch-account-nurturing/SKILL.md' },
  },
  {
    id: 'login-state-checker',
    kind: 'skill',
    title: 'Login state checker',
    description: 'Open windows and verify platform login state',
    icon: '🧩',
    group: 'Skills',
    payload: { skillMdPath: '/Users/anbin/.roxy/skills/login-state-checker/SKILL.md' },
  },
  {
    id: 'profile-warmup-script',
    kind: 'script',
    title: 'Profile warmup script',
    description: 'Run a local browser warmup script before account operations',
    icon: '📄',
    group: 'Scripts',
    payload: { target: '/Users/anbin/.roxy/scripts/profile-warmup.ts' },
  },
]

const suggestion = reactive<SuggestionState>({
  open: false,
  kind: 'mention',
  trigger: '@',
  query: '',
  activeIndex: 0,
  items: [],
  rect: { left: 0, top: 0, width: 0, maxHeight: 320 },
})

const composerShellRef = ref<HTMLElement | null>(null)
const serializedPrompt = ref('')
const demoPresetPrompt = [
  'Open [@profile:MOU-89 · store_admin](profile-mou-89) and run [$Login state checker](/Users/anbin/.roxy/skills/login-state-checker/SKILL.md).',
  'Then execute [@script:Profile warmup script](/Users/anbin/.roxy/scripts/profile-warmup.ts) before posting **normal Markdown source**.',
].join('\n')

function searchItems(source: ComposerItem[], query: string) {
  const keyword = query.trim().toLowerCase()

  if (!keyword)
    return source

  return source.filter(item => [item.title, item.description, item.id, item.group]
    .some(value => value.toLowerCase().includes(keyword)))
}

function groupedItems(items: ComposerItem[]) {
  const groups = new Map<string, ComposerItem[]>()

  items.forEach((item) => {
    const group = groups.get(item.group) ?? []
    group.push(item)
    groups.set(item.group, group)
  })

  return Array.from(groups.entries()).map(([name, groupItems]) => ({ name, items: groupItems }))
}

const suggestionGroups = computed(() => groupedItems(suggestion.items))

function syncSuggestionPosition(props: any, kind: SuggestionState['kind']) {
  const composerRect = composerShellRef.value?.getBoundingClientRect()
  const triggerRect = props.clientRect?.()
  const rect = composerRect ?? triggerRect

  suggestion.open = true
  suggestion.kind = kind
  suggestion.trigger = kind === 'mention' ? '@' : '/'
  suggestion.query = props.query ?? ''
  suggestion.items = props.items ?? []
  suggestion.command = props.command
  suggestion.activeIndex = Math.min(suggestion.activeIndex, Math.max(suggestion.items.length - 1, 0))

  if (rect && composerRect) {
    suggestion.rect.left = rect.left
    suggestion.rect.top = rect.top - 8
    suggestion.rect.width = rect.width
    suggestion.rect.maxHeight = Math.max(140, Math.min(360, rect.top - 24))
  }
  else if (rect) {
    suggestion.rect.left = rect.left
    suggestion.rect.top = rect.bottom + 8
    suggestion.rect.width = 800
    suggestion.rect.maxHeight = 320
  }
}

function openAnchoredSuggestion(options: {
  kind: SuggestionState['kind']
  items: ComposerItem[]
  command: (item: ComposerItem) => void
  query?: string
  activeId?: string
}) {
  const composerRect = composerShellRef.value?.getBoundingClientRect()
  const activeIndex = options.activeId
    ? options.items.findIndex(item => item.id === options.activeId)
    : -1

  suggestion.open = true
  suggestion.kind = options.kind
  suggestion.trigger = options.kind === 'mention' ? '@' : '/'
  suggestion.query = options.query ?? ''
  suggestion.items = options.items
  suggestion.command = options.command
  suggestion.activeIndex = Math.max(activeIndex, 0)

  if (composerRect) {
    suggestion.rect.left = composerRect.left
    suggestion.rect.top = composerRect.top - 8
    suggestion.rect.width = composerRect.width
    suggestion.rect.maxHeight = Math.max(140, Math.min(360, composerRect.top - 24))
  }
}

function closeSuggestion() {
  suggestion.open = false
  suggestion.items = []
  suggestion.command = undefined
  suggestion.activeIndex = 0
}

function createSuggestionRenderer(kind: SuggestionState['kind']) {
  return () => ({
    onStart: (props: any) => {
      suggestion.activeIndex = 0
      syncSuggestionPosition(props, kind)
    },
    onUpdate: (props: any) => {
      syncSuggestionPosition(props, kind)
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (!suggestion.open)
        return false

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        suggestion.activeIndex = (suggestion.activeIndex + 1) % Math.max(suggestion.items.length, 1)
        return true
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        suggestion.activeIndex = (suggestion.activeIndex - 1 + Math.max(suggestion.items.length, 1)) % Math.max(suggestion.items.length, 1)
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
    onExit: closeSuggestion,
  })
}

const AgentToken = Node.create({
  name: 'agentToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: '' },
      kind: { default: 'skill' },
      title: { default: '' },
      description: { default: '' },
      icon: { default: '' },
      group: { default: '' },
      payload: { default: {} },
    }
  },

  parseHTML() {
    return [{
      tag: 'span[data-agent-token]',
      getAttrs: element => ({
        id: element.getAttribute('data-id') || '',
        kind: element.getAttribute('data-kind') || element.getAttribute('data-agent-token') || 'skill',
        title: element.getAttribute('data-title') || element.textContent?.trim() || '',
        description: element.getAttribute('data-description') || '',
        icon: element.getAttribute('data-icon') || '',
        group: element.getAttribute('data-group') || '',
        payload: element.getAttribute('data-payload')
          ? JSON.parse(element.getAttribute('data-payload') || '{}')
          : {},
      }),
    }]
  },

  renderHTML({ node }) {
    const attrs = node.attrs as ComposerItem

    return [
      'span',
      mergeAttributes({
        'data-agent-token': attrs.kind,
        'data-id': attrs.id,
        'data-kind': attrs.kind,
        'data-title': attrs.title,
        'data-description': attrs.description,
        'data-icon': attrs.icon,
        'data-group': attrs.group,
        'data-payload': JSON.stringify(attrs.payload || {}),
        'class': `agent-token agent-token--${attrs.kind}`,
      }),
      `${attrs.icon} ${attrs.title}`,
    ]
  },

  renderText({ node }) {
    const attrs = node.attrs as ComposerItem
    return tokenToProtocol(attrs)
  },
})

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: true,
        items: ({ query }) => searchItems(slashItems, query),
        command: ({ editor, range, props }) => {
          const item = props as ComposerItem

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: 'agentToken', attrs: item },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: createSuggestionRenderer('slash'),
      }),
    ]
  },
})

const editor = useEditor({
  autofocus: true,
  editable: true,
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Open ' },
          {
            type: 'mention',
            attrs: {
              id: 'profile-mou-72',
              label: 'MOU-72 · dance_daily',
              kind: 'profile',
              description: 'tiktok.com/@dance_daily',
              icon: '🌐',
            },
          },
          { type: 'text', text: ' and use ' },
          {
            type: 'agentToken',
            attrs: slashItems[0],
          },
          { type: 'text', text: ' to warm up accounts.' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Try typing @ for windows, / for skills/scripts, and normal Markdown source such as **bold**.' },
        ],
      },
    ],
  },
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      codeBlock: false,
      horizontalRule: false,
    }),
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
          description: node.attrs.description,
          icon: node.attrs.icon || '🌐',
          group: 'Windows',
          payload: { dirId: node.attrs.id },
        })
      },
      renderHTML({ node, options }) {
        return [
          'span',
          mergeAttributes(options.HTMLAttributes, {
            'data-agent-token': 'profile',
            'data-id': node.attrs.id,
            'data-kind': node.attrs.kind || 'profile',
            'data-description': node.attrs.description || '',
          }),
          `${node.attrs.icon || '🌐'} ${node.attrs.label || node.attrs.id}`,
        ]
      },
      suggestion: {
        char: '@',
        allowSpaces: true,
        items: ({ query }) => searchItems(mentionItems, query),
        render: createSuggestionRenderer('mention'),
      },
    }),
    SlashCommand,
  ],
  editorProps: {
    attributes: {
      'class': 'tiptap-composer__editor',
      'aria-label': 'Roxy AI Agent prompt composer demo',
    },
    handleClickOn(_view, _pos, node, nodePos, event, direct) {
      if (!direct || (node.type.name !== 'mention' && node.type.name !== 'agentToken'))
        return false

      event.preventDefault()
      openTokenPicker(node, nodePos)
      return true
    },
    handleClick(_view, _pos, event) {
      const target = event.target as HTMLElement | null

      if (!target?.closest('.agent-token, .mention'))
        closeSuggestion()

      return false
    },
  },
  onUpdate: ({ editor }) => {
    serializedPrompt.value = serializeDoc(editor.getJSON())
  },
  onCreate: ({ editor }) => {
    serializedPrompt.value = serializeDoc(editor.getJSON())
  },
})

const canSubmit = computed(() => Boolean(editor.value?.getText().trim()))
const editorJson = computed(() => JSON.stringify(editor.value?.getJSON() ?? {}, null, 2))

function chooseItem(item?: ComposerItem) {
  if (!item || !suggestion.command)
    return

  suggestion.command(item)
  closeSuggestion()
}

function openTokenPicker(node: any, nodePos: number) {
  const isProfile = node.type.name === 'mention'
  const items = isProfile ? mentionItems : slashItems

  openAnchoredSuggestion({
    kind: isProfile ? 'mention' : 'slash',
    items,
    activeId: node.attrs.id,
    command: (item) => {
      const activeEditor = editor.value

      if (!activeEditor)
        return

      const { schema, tr } = activeEditor.view.state
      const replacement = item.kind === 'profile'
        ? schema.nodes.mention.create({
            id: item.id,
            label: item.label || item.title,
            kind: 'profile',
            description: item.description,
            icon: item.icon,
          })
        : schema.nodes.agentToken.create(item)

      activeEditor.view.dispatch(tr.replaceWith(nodePos, nodePos + node.nodeSize, replacement))
      activeEditor.view.focus()
    },
  })
}

function selectToolbar(trigger: '@' | '/') {
  editor.value?.chain().focus().insertContent(trigger).run()
}

function focusEditor(event?: MouseEvent) {
  const target = event?.target as HTMLElement | null

  if (target?.closest('.ProseMirror'))
    return

  editor.value?.chain().focus('end').run()
}

function clearEditor() {
  editor.value?.commands.clearContent()
  serializedPrompt.value = ''
}

function restoreSerializedPrompt() {
  loadPromptString(serializedPrompt.value)
}

function loadDemoPresetPrompt() {
  loadPromptString(demoPresetPrompt)
}

function loadPromptString(prompt: string) {
  editor.value?.commands.setContent(parsePromptString(prompt))
  serializedPrompt.value = serializeDoc(editor.value?.getJSON())
}

function tokenToProtocol(item: ComposerItem) {
  if (item.kind === 'profile')
    return `[@profile:${item.title}](${item.payload.dirId || item.id})`

  if (item.kind === 'script')
    return `[@script:${item.title}](${item.payload.target || item.id})`

  return `[$${item.title}](${item.payload.skillMdPath || item.id})`
}

function findStoredItem(kind: TokenKind, title: string, target: string): ComposerItem {
  if (kind === 'profile') {
    const profile = mentionItems.find(item =>
      item.id === target
      || item.payload.dirId === target
      || item.title === title
      || item.label === title)

    return profile ?? {
      id: target,
      kind: 'profile',
      title,
      label: title,
      description: '',
      icon: '🌐',
      group: 'Windows',
      payload: { dirId: target },
    }
  }

  const item = slashItems.find(option =>
    option.kind === kind
    && (
      option.id === target
      || option.title === title
      || option.payload.skillMdPath === target
      || option.payload.target === target
    ))

  return item ?? {
    id: target,
    kind,
    title,
    description: '',
    icon: kind === 'skill' ? '🧩' : '📄',
    group: kind === 'skill' ? 'Skills' : 'Scripts',
    payload: kind === 'skill'
      ? { skillMdPath: target }
      : { target },
  }
}

function promptItemToNode(item: ComposerItem) {
  if (item.kind === 'profile') {
    return {
      type: 'mention',
      attrs: {
        id: item.payload.dirId || item.id,
        label: item.label || item.title,
        kind: 'profile',
        description: item.description,
        icon: item.icon,
      },
    }
  }

  return {
    type: 'agentToken',
    attrs: item,
  }
}

function parseInlinePrompt(line: string) {
  const nodes: any[] = []
  const tokenPattern = /\[(@profile|@script):([^\]]+)\]\(([^)]+)\)|\[\$([^\]]+)\]\(([^)]+)\)/g
  let cursor = 0

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0

    if (index > cursor)
      nodes.push({ type: 'text', text: line.slice(cursor, index) })

    const kind: TokenKind = match[1] === '@profile'
      ? 'profile'
      : match[1] === '@script'
        ? 'script'
        : 'skill'
    const title = match[2] || match[4]
    const target = match[3] || match[5]

    nodes.push(promptItemToNode(findStoredItem(kind, title, target)))
    cursor = index + match[0].length
  }

  if (cursor < line.length)
    nodes.push({ type: 'text', text: line.slice(cursor) })

  return nodes
}

function parsePromptString(prompt: string) {
  const lines = prompt.split(/\n/)
  const content = lines.map(line => ({
    type: 'paragraph',
    content: parseInlinePrompt(line),
  }))

  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  }
}

function serializeDoc(doc: any) {
  const lines: string[] = []

  function visit(node: any): string {
    if (!node)
      return ''

    if (node.type === 'text')
      return node.text || ''

    if (node.type === 'mention') {
      return tokenToProtocol({
        id: node.attrs.id,
        kind: 'profile',
        title: node.attrs.label || node.attrs.id,
        description: node.attrs.description || '',
        icon: node.attrs.icon || '🌐',
        group: 'Windows',
        payload: { dirId: node.attrs.id },
      })
    }

    if (node.type === 'agentToken')
      return tokenToProtocol(node.attrs)

    const children = (node.content || []).map(visit).join('')

    if (node.type === 'paragraph') {
      lines.push(children)
      return ''
    }

    return children
  }

  visit(doc)
  return lines.join('\n').trim()
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="tiptap-demo">
    <section class="demo-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">
            Tiptap headless
          </p>
          <h2>Agent composer proof of concept</h2>
        </div>

        <div class="toolbar">
          <button type="button" title="Mention window" @click="selectToolbar('@')">
            @
          </button>
          <button type="button" title="Invoke skills / scripts" @click="selectToolbar('/')">
            /
          </button>
          <button type="button" title="Clear" @click="clearEditor">
            Clear
          </button>
          <button type="button" title="Set content from the serialized prompt string" @click="restoreSerializedPrompt">
            Reload string
          </button>
          <button type="button" title="Load a saved prompt string" @click="loadDemoPresetPrompt">
            Load preset
          </button>
        </div>
      </div>

      <div ref="composerShellRef" class="composer-shell" @click="focusEditor">
        <EditorContent v-if="editor" :editor="editor" />

        <div class="composer-row">
          <div class="composer-tools">
            <button type="button" title="Attach file">
              📎
            </button>
            <button type="button" title="Cite window" @click="selectToolbar('@')">
              @
            </button>
            <button type="button" title="Invoke skills / scripts" @click="selectToolbar('/')">
              /
            </button>
            <button class="approval-mode" type="button">
              🛡 Ask for approval
            </button>
          </div>

          <button class="send-button" type="button" :disabled="!canSubmit">
            ↑
          </button>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="suggestion.open"
          class="suggestion-popover"
          :style="{
            left: `${suggestion.rect.left}px`,
            top: `${suggestion.rect.top}px`,
            width: `${suggestion.rect.width}px`,
            maxHeight: `${suggestion.rect.maxHeight}px`,
            transform: composerShellRef ? 'translateY(-100%)' : 'none',
          }"
        >
          <template v-if="suggestionGroups.length">
            <section v-for="group in suggestionGroups" :key="group.name" class="suggestion-group">
              <div class="suggestion-heading">
                {{ group.name }}({{ group.items.length }})
              </div>
              <button
                v-for="item in group.items"
                :key="item.id"
                class="suggestion-item"
                :class="{ 'suggestion-item--active': suggestion.items[suggestion.activeIndex]?.id === item.id }"
                type="button"
                @mouseenter="suggestion.activeIndex = suggestion.items.findIndex(option => option.id === item.id)"
                @mousedown.prevent="chooseItem(item)"
              >
                <span class="suggestion-icon">{{ item.icon }}</span>
                <span class="suggestion-title">{{ item.title }}</span>
                <span class="suggestion-desc">{{ item.description }}</span>
              </button>
            </section>
          </template>
          <div v-else class="suggestion-empty">
            No result for "{{ suggestion.query }}"
          </div>
        </div>
      </Teleport>
    </section>

    <section class="inspector-grid">
      <div class="inspector">
        <h3>Serialized prompt</h3>
        <pre>{{ serializedPrompt }}</pre>
      </div>

      <div class="inspector inspector--wide">
        <h3>Tiptap JSON</h3>
        <pre>{{ editorJson }}</pre>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.tiptap-demo {
  min-height: 100%;
  padding: 32px;
  color: #141414;
  background: #f7f8fa;
}

.demo-panel,
.inspector {
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  background: #fcfcfc;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
}

.demo-panel {
  max-width: 920px;
  padding: 24px;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h2 {
    margin: 2px 0 0;
    font-size: 20px;
    font-weight: 650;
    line-height: 28px;
  }
}

.eyebrow {
  margin: 0;
  color: #737373;
  font-size: 12px;
  line-height: 18px;
  text-transform: uppercase;
}

.toolbar,
.composer-tools {
  display: flex;
  align-items: center;
  gap: 6px;

  button {
    display: inline-flex;
    min-width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    color: #141414;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: #f5f5f5;
    }
  }
}

.composer-shell {
  position: relative;
  display: flex;
  min-height: 128px;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  padding: 16px;
  border: 1px solid #3faaf6;
  border-radius: 16px;
  background: #fafafa;
  box-shadow: 0 16px 40px rgba(243, 89, 220, 0.14);
}

.composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.approval-mode {
  gap: 4px;
  white-space: nowrap;
}

.send-button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(101deg, #3faaf6 10%, #f359dc 45%, #f28fb0 100%);
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
}

:deep(.tiptap-composer__editor) {
  min-height: 48px;
  max-height: 180px;
  overflow-y: auto;
  outline: none;
  color: #141414;
  font-size: 14px;
  line-height: 22px;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 6px;
  }

  code {
    padding: 1px 5px;
    border-radius: 6px;
    color: #c11574;
    background: #fce7f6;
  }
}

:deep(.agent-token),
:deep(.mention) {
  display: inline-flex;
  max-width: 260px;
  align-items: center;
  gap: 4px;
  margin: 0 2px;
  padding: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
  vertical-align: baseline;
  white-space: nowrap;
}

:deep(.agent-token--profile),
:deep(.mention) {
  color: #175cd3;
  background: #d1e9ff;
}

:deep(.agent-token--skill) {
  color: #c11574;
  background: #fce7f6;
}

:deep(.agent-token--script) {
  color: #067647;
  background: #dcfae6;
}

.inspector-grid {
  display: grid;
  max-width: 1100px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.inspector {
  min-height: 220px;
  padding: 16px;

  h3 {
    margin: 0 0 12px;
    color: #525252;
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
  }

  pre {
    max-height: 360px;
    margin: 0;
    overflow: auto;
    color: #292929;
    font-size: 12px;
    line-height: 18px;
    white-space: pre-wrap;
  }
}

.inspector--wide {
  grid-column: 1 / -1;
}
</style>

<style lang="scss">
.suggestion-popover {
  position: fixed;
  z-index: 9999;
  width: min(800px, calc(100vw - 48px));
  max-height: min(360px, calc(100vh - 80px));
  overflow: auto;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  background: #fcfcfc;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
}

.suggestion-group + .suggestion-group {
  border-top: 1px solid #e5e5e5;
}

.suggestion-heading {
  padding: 12px 20px;
  color: #737373;
  font-size: 14px;
  line-height: 20px;
}

.suggestion-item {
  display: flex;
  width: calc(100% - 24px);
  align-items: center;
  gap: 9px;
  margin: 0 12px 4px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  color: #141414;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
  text-align: left;

  &:hover,
  &--active {
    background: #f5f5f5;
  }
}

.suggestion-icon {
  flex: none;
  width: 16px;
  text-align: center;
}

.suggestion-title {
  flex: none;
  white-space: nowrap;
}

.suggestion-desc {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #737373;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-empty {
  padding: 20px;
  color: #737373;
  font-size: 14px;
  text-align: center;
}
</style>
