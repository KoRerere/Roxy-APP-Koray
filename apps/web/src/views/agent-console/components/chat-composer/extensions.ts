import { Extension, mergeAttributes, Node } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import { Suggestion } from '@tiptap/suggestion'
import type { AgentComposerItem, AgentComposerTokenKind } from './types'
import { tokenToProtocol } from './protocol'
import { formatAgentProfileDetails, getAgentProfileLabelsFromPayload } from '../../profile-token-display'
import { getUrlFaviconUrl } from '../../utils/urlFavicon'

export const ComposerLink = Link.extend({
  inclusive: false,

  renderHTML({ HTMLAttributes }) {
    const faviconUrl = getUrlFaviconUrl(HTMLAttributes.href)
    const faviconAttributes = faviconUrl
      ? { 'data-agent-favicon-url': faviconUrl }
      : {}

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, faviconAttributes),
      0,
    ]
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      markdownSource: {
        default: null,
        parseHTML: element => element.getAttribute('data-markdown-source'),
        renderHTML: attributes => attributes.markdownSource
          ? { 'data-markdown-source': attributes.markdownSource }
          : {},
      },
    }
  },
}).configure({
  shouldAutoLink: url => /^https?:\/\//i.test(url),
})

export const AgentToken = Node.create({
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
      label: { default: '' },
      description: { default: '' },
      iconName: { default: '' },
      group: { default: '' },
      payload: { default: {} },
    }
  },

  parseHTML() {
    return [{
      tag: 'span[data-agent-token]',
      getAttrs: (element) => {
        const payload = element.getAttribute('data-payload')

        return {
          id: element.getAttribute('data-id') || '',
          kind: element.getAttribute('data-kind') || element.getAttribute('data-agent-token') || 'skill',
          title: element.getAttribute('data-title') || element.textContent?.trim() || '',
          label: element.getAttribute('data-label') || '',
          description: element.getAttribute('data-description') || '',
          iconName: element.getAttribute('data-icon-name') || '',
          group: element.getAttribute('data-group') || '',
          payload: payload ? parseTokenPayload(payload) : {},
        }
      },
    }]
  },

  renderHTML({ node }) {
    const attrs = node.attrs as AgentComposerItem
    const kind = normalizeTokenKind(attrs.kind)
    const iconName = attrs.iconName || getAgentTokenIconName(kind)
    const label = getAgentTokenLabel(attrs)
    const profileCount = getProfileTokenCount(attrs)
    const profileDetails = formatAgentProfileDetails(
      getAgentProfileLabelsFromPayload(attrs.payload),
      profileCount,
      getProfileTokenDirIds(attrs),
    )
    const isEmptyInput = (kind === 'input' || kind === 'textarea' || kind === 'url') && !attrs.payload.value?.trim()
    const isEmptyProfile = kind === 'profile' && profileCount === 0

    return [
      'span',
      mergeAttributes({
        'data-agent-token': kind,
        'data-id': attrs.id,
        'data-kind': kind,
        'data-title': attrs.title,
        'data-label': attrs.label || '',
        'data-description': attrs.description,
        'data-icon-name': attrs.iconName,
        'data-group': attrs.group,
        'data-payload': JSON.stringify(attrs.payload || {}),
        'class': [
          'agent-token',
          `agent-token--${kind}`,
          isEmptyInput ? 'agent-token--input-empty' : '',
          isEmptyProfile ? 'agent-token--profile-empty' : '',
        ].filter(Boolean).join(' '),
      }),
      ...(kind === 'profile' && profileCount > 0
        ? [
            [
              'span',
              { class: 'agent-token__profile-prefix' },
              [
                'span',
                { class: 'agent-token__icon' },
                [
                  'roxy-svg-icon',
                  {
                    name: iconName,
                    fallback: getAgentTokenIconName(kind),
                    size: 16,
                  },
                ],
              ],
              [
                'span',
                { class: 'agent-token__label' },
                label,
              ],
            ],
            [
              'span',
              { class: 'agent-token__profile-detail' },
              ['span', { class: 'agent-token__profile-names' }, profileDetails],
              ['span', {
                'aria-label': 'Remove token',
                'contenteditable': 'false',
                'data-agent-token-remove': '',
                'role': 'button',
                'class': 'agent-token__remove',
              }, ['roxy-svg-icon', { name: 'base/rx_ic_delete', size: 12 }]],
            ],
          ]
        : [
            ['span', { class: 'agent-token__icon' }, [
              'roxy-svg-icon',
              { name: iconName, fallback: getAgentTokenIconName(kind), size: 16 },
            ]],
            ['span', { class: 'agent-token__label' }, label],
          ]),
      ...(kind === 'input' || kind === 'textarea' || kind === 'url' || (kind === 'profile' && profileCount > 0)
        ? []
        : [[
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
          ]]),
    ]
  },

  renderText({ node }) {
    return tokenToProtocol(node.attrs as AgentComposerItem)
  },
})

export function createSlashCommandExtension(options: {
  getItems: (query: string) => AgentComposerItem[] | Promise<AgentComposerItem[]>
  command: (options: { editor: any, range: any, item: AgentComposerItem }) => void
  render: any
}) {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          items: ({ query }) => options.getItems(query),
          command: ({ editor, range, props }) => {
            options.command({ editor, range, item: props as AgentComposerItem })
          },
          render: options.render,
        }),
      ]
    },
  })
}

function parseTokenPayload(payload: string) {
  try {
    return JSON.parse(payload)
  }
  catch {
    return {}
  }
}

export function normalizeTokenKind(kind: string): AgentComposerTokenKind {
  return kind === 'profile' || kind === 'script' || kind === 'skill' || kind === 'input' || kind === 'textarea' || kind === 'url' ? kind : 'skill'
}

export function getAgentTokenIconName(kind: AgentComposerTokenKind) {
  if (kind === 'input' || kind === 'textarea') {
    return 'roxy-agent/rx-ic-prompts'
  }

  if (kind === 'url') {
    return 'roxy-agent/rx-ic-url'
  }

  if (kind === 'profile') {
    return 'roxy-agent/rx-ic-token-profile'
  }

  if (kind === 'script') {
    return 'roxy-agent/rx-ic-scripts'
  }

  return 'roxy-agent/rx-ic-skills'
}

function getAgentTokenLabel(attrs: AgentComposerItem) {
  if (attrs.kind === 'profile') {
    return getProfileTokenCount(attrs) > 0 ? $t('窗口') : $t('选择窗口')
  }

  if (attrs.kind !== 'input' && attrs.kind !== 'textarea' && attrs.kind !== 'url') {
    return attrs.title
  }

  return attrs.payload.value?.trim() || attrs.title
}

function getProfileTokenCount(attrs: AgentComposerItem) {
  if (attrs.kind !== 'profile') {
    return 0
  }

  const targets = attrs.payload.dirIds || attrs.payload.dirId || attrs.id || ''

  if (targets.trim()) {
    return targets
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .length
  }

  const count = Number(attrs.payload.count)
  return Number.isFinite(count) ? count : 0
}

function getProfileTokenDirIds(attrs: AgentComposerItem) {
  if (attrs.kind !== 'profile') {
    return []
  }

  return (attrs.payload.dirIds || attrs.payload.dirId || attrs.id || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}
