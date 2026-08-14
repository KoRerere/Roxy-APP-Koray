import {
  parseTemplateRef,
  serializeAgentProfileReference,
  serializeAgentScriptReference,
  serializeAgentSkillReference,
} from '@roxy/shared'
import type { AgentComposerDoc, AgentComposerItem, AgentComposerTokenKind } from './types'
import { cacheAgentProfileLabels, getCachedAgentProfileLabels, normalizeAgentProfileLabel } from '../../profile-token-display'

function createProtocolTokenPattern() {
  return /\[(@profile|@script):([^\]]*)\]\(([^)]*)\)|\[(input|url):([^\]]+)\](?:\(([^)]*)\))?|\[\$([^\]]+)\]\(([^)]*)\)/g
}

const MARKDOWN_LINK_PATTERN = /\[((?:\\.|[^\]\\\n])*)\]\(((?:\\.|[^)\\\n])*)\)/g
const TODAY_DATE_INPUT_DEFAULT = '今天日期'

export function resolveInputDefaultValue(value: string, now = new Date()): string {
  if (value.trim() !== TODAY_DATE_INPUT_DEFAULT)
    return value

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface ComposerProtocolToken {
  index: number
  kind: AgentComposerTokenKind
  raw: string
  target: string
  templateRef?: string
  title: string
}

function parseProtocolToken(match: RegExpMatchArray): ComposerProtocolToken {
  const kind: AgentComposerTokenKind = match[1] === '@profile'
    ? 'profile'
    : match[1] === '@script'
      ? 'script'
      : match[4] === 'input' || match[4] === 'url'
        ? match[4]
        : 'skill'
  const title = match[2] || match[5] || match[7] || ''
  const target = match[3] ?? match[6] ?? match[8] ?? ''
  const token: ComposerProtocolToken = {
    index: match.index ?? 0,
    kind,
    raw: match[0],
    target,
    title,
  }

  if (kind === 'script' || kind === 'skill') {
    try {
      token.templateRef = parseTemplateRef(target).value
    }
    catch {
      // Invalid historical references remain plain text in the composer.
    }
  }

  return token
}

export function scanComposerProtocolTokens(prompt: string): ComposerProtocolToken[] {
  return Array.from(prompt.matchAll(createProtocolTokenPattern()), parseProtocolToken)
}

export function hasComposerProtocolTokens(prompt: string) {
  return scanComposerProtocolTokens(prompt).some((token) => {
    return token.kind === 'profile' || token.kind === 'input' || token.kind === 'url' || Boolean(token.templateRef)
  })
}

export function getMissingComposerTokenLabels(prompt: string) {
  const tokens = scanComposerProtocolTokens(prompt)
  const requiresFilledInputs = tokens.some(token => token.kind === 'skill' && token.templateRef)

  if (!requiresFilledInputs)
    return []

  const labels: string[] = []

  for (const token of tokens) {
    if ((token.kind === 'input' || token.kind === 'url') && !token.target.trim()) {
      labels.push(token.title)
    }
  }

  return Array.from(new Set(labels))
}

export function getInvalidTemplateReferenceLabels(prompt: string): string[] {
  return Array.from(new Set(
    scanComposerProtocolTokens(prompt)
      .filter(token => (token.kind === 'script' || token.kind === 'skill') && !token.templateRef)
      .map(token => token.title || token.target),
  ))
}

export function searchComposerItems(items: AgentComposerItem[], query: string) {
  const keyword = query.trim().toLowerCase()

  if (!keyword)
    return items

  return items.filter(item => [
    item.title,
    item.label,
    item.description,
    item.kind,
    item.id,
    item.group,
    item.template?.prompt,
    item.payload.dirIds,
    item.payload.dirId,
    item.payload.templateRef,
  ].some(value => value?.toLowerCase().includes(keyword)))
}

export function tokenToProtocol(item: AgentComposerItem) {
  if (item.kind === 'input' || item.kind === 'url')
    return inputTokenToProtocol(item)

  if (item.kind === 'profile')
    return profileTokenToProtocol(getProfileDirIds(item))

  if (item.kind === 'script') {
    const templateRef = getItemTemplateRef(item)
    return templateRef ? serializeAgentScriptReference(item.title, templateRef) : ''
  }

  if (item.kind === 'template')
    return templateItemToPrompt(item)

  const templateRef = getItemTemplateRef(item)
  return templateRef ? serializeAgentSkillReference(item.title, templateRef) : ''
}

function getItemTemplateRef(item: AgentComposerItem): string | undefined {
  const templateRef = item.payload.templateRef
  if (!templateRef) {
    return undefined
  }

  try {
    return parseTemplateRef(templateRef).value
  }
  catch {
    return undefined
  }
}

function inputTokenToProtocol(item: AgentComposerItem) {
  const value = item.payload.value?.trim()

  if (item.kind === 'url')
    return `[url:${item.title || item.id}](${normalizeUrlValue(value)})`

  if (value)
    return value

  return `[input:${item.title || item.id}]()`
}

export function templateItemToPrompt(
  item: AgentComposerItem,
  options: { includeAuxiliaryPrompt?: boolean } = {},
) {
  const tokenPrompt = item.template?.tokens.map(tokenToProtocol).join(' ') ?? ''
  const prompt = options.includeAuxiliaryPrompt === false ? '' : item.template?.prompt.trim() ?? ''

  return [tokenPrompt, prompt].filter(Boolean).join(' ').trim()
}

function profileTokenToProtocol(dirIds: string[]) {
  return serializeAgentProfileReference(dirIds)
}

export function getProfileDirIds(item: AgentComposerItem) {
  return splitProfileDirIds(item.payload.dirIds || item.payload.dirId || item.id)
}

export function createProfileAggregateItem(items: AgentComposerItem[]): AgentComposerItem {
  const dirIds = items.flatMap(getProfileDirIds)
  const label = `Window × ${dirIds.length}`
  const profileLabels = items.flatMap((item) => {
    const itemIds = getProfileDirIds(item)
    const storedLabels = readStoredProfileLabels(item)

    return itemIds.map((id, index) => storedLabels[index] || getProfileItemDisplayLabel(item) || id)
  })

  cacheAgentProfileLabels(dirIds.map((id, index) => ({ id, label: profileLabels[index] || id })))

  return {
    id: dirIds.join(','),
    kind: 'profile',
    title: label,
    label,
    description: '',
    iconName: 'roxy-agent/rx-ic-token-profile',
    group: 'Windows',
    payload: {
      dirIds: dirIds.join(','),
      count: String(dirIds.length),
      profileLabels: JSON.stringify(profileLabels),
    },
  }
}

function readStoredProfileLabels(item: AgentComposerItem) {
  if (!item.payload.profileLabels)
    return []

  try {
    const labels = JSON.parse(item.payload.profileLabels)
    return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : []
  }
  catch {
    return []
  }
}

function getProfileItemDisplayLabel(item: AgentComposerItem) {
  return normalizeAgentProfileLabel(item.payload.displayLabel || item.label || item.title)
}

export function findStoredComposerItem(options: {
  kind: AgentComposerTokenKind
  title: string
  target: string
  profiles: AgentComposerItem[]
  slashItems: AgentComposerItem[]
}): AgentComposerItem | undefined {
  const { kind, title, target, profiles, slashItems } = options

  if (kind === 'input' || kind === 'url') {
    return createInputTokenItem(title, target, kind)
  }

  if (kind === 'profile') {
    const profile = profiles.find(item =>
      item.id === target
      || item.payload.dirId === target)
    const cachedLabel = getCachedAgentProfileLabels([target])[0]

    return profile ?? {
      id: target,
      kind: 'profile',
      title: cachedLabel || target,
      label: cachedLabel || target,
      description: '',
      iconName: 'country-code/US',
      group: 'Windows',
      payload: { dirId: target },
    }
  }

  if (kind !== 'script' && kind !== 'skill') {
    return undefined
  }

  try {
    const templateRef = parseTemplateRef(target).value
    const storedItem = slashItems.find(item => item.kind === kind && item.payload.templateRef === templateRef)

    if (storedItem) {
      return storedItem
    }

    const conflictingItem = slashItems.find(item =>
      (item.kind === 'script' || item.kind === 'skill')
      && item.kind !== kind
      && item.payload.templateRef === templateRef,
    )

    if (conflictingItem) {
      return undefined
    }

    return createTemplateReferenceItem({ kind, title, templateRef })
  }
  catch {
    return undefined
  }
}

function createTemplateReferenceItem(options: {
  kind: 'script' | 'skill'
  title: string
  templateRef: string
}): AgentComposerItem {
  const { kind, title, templateRef } = options

  return {
    id: templateRef,
    kind,
    title,
    label: title,
    description: '',
    iconName: kind === 'skill' ? 'roxy-agent/rx-ic-skills' : 'roxy-agent/rx-ic-scripts',
    group: kind === 'skill' ? 'Skills' : 'Scripts',
    payload: { templateRef },
  }
}

export function createInputTokenItem(
  title: string,
  value = '',
  kind: Extract<AgentComposerTokenKind, 'input' | 'url'> = 'input',
): AgentComposerItem {
  const normalizedValue = kind === 'url' ? normalizeUrlValue(value) : value
  return {
    id: `${kind}:${title}`,
    kind,
    title,
    label: title,
    description: '',
    iconName: kind === 'url' ? 'roxy-agent/rx-ic-url' : 'roxy-agent/rx-ic-prompts',
    group: 'Inputs',
    payload: { name: title, value: normalizedValue },
  }
}

export function splitUrlValue(value: string | undefined): {
  protocol: 'http://' | 'https://'
  value: string
} {
  const trimmedValue = value?.trim() ?? ''
  const protocolMatch = /^(https?):\/\//i.exec(trimmedValue)

  if (!protocolMatch) {
    return {
      protocol: 'https://',
      value: trimmedValue.replace(/^\/\//, ''),
    }
  }

  return {
    protocol: protocolMatch[1].toLowerCase() === 'http' ? 'http://' : 'https://',
    value: trimmedValue.slice(protocolMatch[0].length),
  }
}

export function normalizeUrlValue(value: string | undefined) {
  const parts = splitUrlValue(value)
  return parts.value ? `${parts.protocol}${parts.value}` : ''
}

export function updateInputTokenValue(
  doc: AgentComposerDoc | undefined,
  title: string,
  value: string,
  kind: Extract<AgentComposerTokenKind, 'input' | 'url'> = 'input',
) {
  if (!doc)
    return doc

  const normalizedTitle = title.trim()

  function visit(node: any): any {
    if (!node || typeof node !== 'object')
      return node

    if (node.type === 'agentToken') {
      if (node.attrs?.kind === kind && getInputTokenTitle(node.attrs) === normalizedTitle) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            title: normalizedTitle,
            label: node.attrs?.label || normalizedTitle,
            payload: {
              ...(node.attrs?.payload || {}),
              name: normalizedTitle,
              value: kind === 'url' ? normalizeUrlValue(value) : value,
            },
          },
        }
      }
    }

    if (Array.isArray(node.content)) {
      return {
        ...node,
        content: node.content.map(visit),
      }
    }

    return node
  }

  return visit(doc)
}

export function composerItemToNode(item: AgentComposerItem) {
  return {
    type: 'agentToken',
    attrs: item,
  }
}

export function parsePromptString(
  prompt: string,
  options: {
    profiles: AgentComposerItem[]
    slashItems: AgentComposerItem[]
  },
): AgentComposerDoc {
  const lines = prompt.split(/\n/)
  const content = lines.map(line => ({
    type: 'paragraph',
    content: parsePromptLine(line, options),
  }))

  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  }
}

export function serializePromptDoc(doc: AgentComposerDoc | undefined) {
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
        label: node.attrs.label || node.attrs.id,
        description: node.attrs.description || '',
        iconName: node.attrs.iconName || 'base/rx_ic_at',
        group: 'Windows',
        payload: { dirId: node.attrs.id },
      })
    }

    if (node.type === 'agentToken')
      return tokenToProtocol(node.attrs)

    if (node.type === 'paragraph') {
      lines.push(serializeParagraphContent(node.content || []))
      return ''
    }

    const children = (node.content || []).map(visit).join('')

    return children
  }

  visit(doc)
  return lines.join('\n').trim()
}

function serializeParagraphContent(nodes: any[]) {
  const chunks: string[] = []
  let pendingProfileDirIds: string[] = []
  let pendingWhitespace = ''

  function flushProfiles() {
    if (!pendingProfileDirIds.length)
      return

    chunks.push(profileTokenToProtocol(pendingProfileDirIds))
    pendingProfileDirIds = []
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]

    if (node.type === 'mention') {
      pendingProfileDirIds.push(node.attrs.id)
      pendingWhitespace = ''
      continue
    }

    if (node.type === 'text' && pendingProfileDirIds.length && /^\s+$/.test(node.text || '')) {
      pendingWhitespace = node.text || ''
      continue
    }

    flushProfiles()

    if (pendingWhitespace) {
      chunks.push(pendingWhitespace)
      pendingWhitespace = ''
    }

    const linkHref = getLinkHref(node)
    if (linkHref) {
      const linkedNodes = [node]

      while (getLinkHref(nodes[index + 1]) === linkHref) {
        index += 1
        linkedNodes.push(nodes[index])
      }

      const nextInlineText = serializeInlineNode(nodes[index + 1])
      const needsExplicitBoundary = Boolean(nextInlineText && !/^\s/u.test(nextInlineText))
      chunks.push(serializeLink(
        linkedNodes.map(serializeInlineNode).join(''),
        linkHref,
        needsExplicitBoundary,
        getLinkMarkdownSource(node),
      ))
      continue
    }

    chunks.push(serializeInlineNode(node))
  }

  flushProfiles()

  if (pendingWhitespace)
    chunks.push(pendingWhitespace)

  return chunks.join('')
}

function getLinkHref(node: any): string {
  if (node?.type !== 'text' || !Array.isArray(node.marks))
    return ''

  const linkMark = node.marks.find((mark: any) => mark?.type === 'link')
  return typeof linkMark?.attrs?.href === 'string' ? linkMark.attrs.href.trim() : ''
}

function getLinkMarkdownSource(node: any): string {
  if (node?.type !== 'text' || !Array.isArray(node.marks))
    return ''

  const linkMark = node.marks.find((mark: any) => mark?.type === 'link')
  return typeof linkMark?.attrs?.markdownSource === 'string'
    ? linkMark.attrs.markdownSource
    : ''
}

function serializeLink(label: string, href: string, needsExplicitBoundary = false, markdownSource = '') {
  if (markdownSource && label === href)
    return markdownSource

  if (!label || (label === href && !needsExplicitBoundary))
    return href

  const escapedLabel = label
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
  const escapedHref = href
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
  return `[${escapedLabel}](${escapedHref})`
}

function serializeInlineNode(node: any): string {
  if (!node)
    return ''

  if (node.type === 'text')
    return node.text || ''

  if (node.type === 'hardBreak') {
    return '\n'
  }

  if (node.type === 'agentToken')
    return tokenToProtocol(node.attrs)

  if (node.type === 'mention') {
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
  }

  return (node.content || []).map(serializeInlineNode).join('')
}

function parsePromptLine(
  line: string,
  options: {
    profiles: AgentComposerItem[]
    slashItems: AgentComposerItem[]
  },
) {
  const nodes: any[] = []
  const tokenPattern = createProtocolTokenPattern()
  let cursor = 0

  while (cursor < line.length) {
    tokenPattern.lastIndex = cursor
    MARKDOWN_LINK_PATTERN.lastIndex = cursor

    const tokenMatch = tokenPattern.exec(line)
    const linkMatch = MARKDOWN_LINK_PATTERN.exec(line)
    const useToken = tokenMatch && (!linkMatch || tokenMatch.index <= linkMatch.index)
    const nextMatch = useToken ? tokenMatch : linkMatch

    if (!nextMatch)
      break

    const index = nextMatch.index
    if (index > cursor) {
      nodes.push({ type: 'text', text: line.slice(cursor, index) })
    }

    if (useToken) {
      const token = parseProtocolToken(tokenMatch)
      const targets = token.kind === 'profile' ? splitProfileDirIds(token.target) : [token.target]

      if (token.kind === 'input' || token.kind === 'url') {
        const value = token.kind === 'input'
          ? resolveInputDefaultValue(token.target)
          : token.target
        nodes.push(composerItemToNode(createInputTokenItem(token.title, value, token.kind)))
      }
      else if (token.kind === 'profile') {
        const profileItems = targets.map(profileTarget => findStoredComposerItem({
          kind: token.kind,
          title: token.title,
          target: profileTarget,
          profiles: options.profiles,
          slashItems: options.slashItems,
        })).filter((item): item is AgentComposerItem => Boolean(item))

        nodes.push(composerItemToNode(createProfileAggregateItem(profileItems)))
      }
      else {
        const storedItem = token.templateRef
          ? findStoredComposerItem({
              kind: token.kind,
              title: token.title,
              target: token.templateRef,
              profiles: options.profiles,
              slashItems: options.slashItems,
            })
          : undefined

        if (storedItem) {
          nodes.push(composerItemToNode(storedItem))
        }
        else {
          nodes.push({ type: 'text', text: token.raw })
        }
      }

      cursor = token.index + token.raw.length
      continue
    }

    const label = unescapeMarkdownLinkValue(linkMatch[1])
    const href = unescapeMarkdownLinkValue(linkMatch[2])
    if (label && href) {
      nodes.push({
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href, markdownSource: linkMatch[0] } }],
      })
    }
    else {
      nodes.push({ type: 'text', text: linkMatch[0] })
    }

    cursor = linkMatch.index + linkMatch[0].length
  }

  if (cursor < line.length) {
    nodes.push({ type: 'text', text: line.slice(cursor) })
  }

  return nodes
}

function unescapeMarkdownLinkValue(value: string) {
  return value.replace(/\\(.)/g, (match, character: string) => {
    return '\\[]()'.includes(character) ? character : match
  })
}

function splitProfileDirIds(target: string) {
  return target
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function getInputTokenTitle(attrs: Record<string, any> | undefined) {
  const title = typeof attrs?.title === 'string' ? attrs.title.trim() : ''
  const label = typeof attrs?.label === 'string' ? attrs.label.trim() : ''
  const payloadName = typeof attrs?.payload?.name === 'string' ? attrs.payload.name.trim() : ''

  return title || label || payloadName
}
