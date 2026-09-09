import type { JSONContent } from '@tiptap/core'

export type AgentComposerTokenKind = 'profile' | 'skill' | 'script' | 'input' | 'textarea' | 'url' | 'project'
export type AgentComposerItemKind = AgentComposerTokenKind | 'template'

export type AgentComposerSuggestionKind = 'mention' | 'slash'
export type AgentComposerTemplateSource = 'official' | 'user'

export interface AgentComposerItem {
  id: string
  kind: AgentComposerItemKind
  title: string
  label?: string
  description: string
  iconName: string
  isOpen?: boolean
  unread?: boolean
  isTopped?: boolean
  toppedAt?: string | null
  isTopping?: boolean
  templateId?: number
  templateSource?: AgentComposerTemplateSource
  group: string
  payload: Record<string, string>
  template?: {
    prompt: string
    tokens: AgentComposerItem[]
  }
}

export interface AgentComposerProjectOption {
  label: string
  value: string
  projectName?: string
}

export interface AgentComposerSuggestionState {
  open: boolean
  loading: boolean
  kind: AgentComposerSuggestionKind
  trigger: '@' | '/'
  query: string
  activeIndex: number
  items: AgentComposerItem[]
  command?: (item: AgentComposerItem) => void
  range?: { from: number, to: number }
}

export type AgentComposerDoc = JSONContent
