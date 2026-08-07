import type { Tokens } from 'marked'
import { marked, Renderer } from 'marked'
import { escapeHtml } from './markdownHtml'

interface AgentMarkdownToken {
  raw?: string
  kind: 'profile' | 'script' | 'skill' | 'input'
  marker: '@' | '/' | ''
  title: string
  target: string
}

const AGENT_TOKEN_START_PATTERN = /\[(@profile|@script|input):|\[\$/
const AGENT_PROTOCOL_TOKEN_PATTERN = /\[(@profile|@script):([^\]]+)\]\(([^)]*)\)|\[input:([^\]]+)\](?:\(([^)]*)\))?|\[\$([^\]]+)\]\(([^)]+)\)/g
const defaultRenderer = new Renderer()

marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    link(this: { parser: unknown }, token: Tokens.Link) {
      return renderMarkdownLinkHtml(token, this.parser)
    },
    table(this: { parser: unknown }, token: Tokens.Table) {
      return renderMarkdownTableHtml(token, this.parser)
    },
  },
  extensions: [
    {
      name: 'agentToken',
      level: 'inline',
      start(src: string) {
        const tokenIndex = src.search(AGENT_TOKEN_START_PATTERN)
        return tokenIndex === -1 ? undefined : tokenIndex
      },
      tokenizer(src: string) {
        return matchAgentTokenAtStart(src)
      },
      renderer(token: AgentMarkdownToken) {
        return renderAgentTokenHtml(token)
      },
    },
  ],
})

export function renderMarkdown(text: string, options: { preserveLineBreaks?: boolean } = {}) {
  const html = marked.parse(normalizeWindowsLocalFileLinkDestinations(text), {
    async: false,
    breaks: options.preserveLineBreaks ?? false,
  })
  return normalizeMarkdownLinks(html)
}

function normalizeWindowsLocalFileLinkDestinations(markdown: string) {
  return markdown.replace(
    /(\[[^\]\n]*\]\()((?:\/[a-z]:|[a-z]:|file:\/\/\/?[a-z]:)[^)\n]*)(\))/gi,
    (_, prefix: string, destination: string, suffix: string) => {
      return `${prefix}${normalizeWindowsDriveLocalPath(destination).replace(/\\+/g, '/')}${suffix}`
    },
  )
}

function matchAgentTokenAtStart(src: string): (AgentMarkdownToken & { type: 'agentToken', raw: string }) | undefined {
  const match = AGENT_PROTOCOL_TOKEN_PATTERN.exec(src)
  AGENT_PROTOCOL_TOKEN_PATTERN.lastIndex = 0
  if (!match || match.index !== 0)
    return undefined

  const token = tokenFromProtocolMatch(match)
  return {
    type: 'agentToken',
    raw: match[0],
    ...token,
  }
}

function tokenFromProtocolMatch(match: RegExpExecArray): AgentMarkdownToken {
  if (match[1]) {
    const kind = match[1] === '@profile' ? 'profile' : 'script'
    return {
      kind,
      marker: kind === 'profile' ? '@' : '/',
      title: match[2] || '',
      target: match[3] || '',
    }
  }

  if (match[4]) {
    return {
      kind: 'input',
      marker: '',
      title: match[4],
      target: match[5] || '',
    }
  }

  return {
    kind: 'skill',
    marker: '/',
    title: match[6] || '',
    target: match[7] || '',
  }
}

function renderAgentTokenHtml(token: AgentMarkdownToken) {
  const display = getAgentTokenDisplay(token)
  const countAttribute = display.count ? ` count="${escapeAttribute(display.count)}"` : ''
  return `<roxy-agent-token kind="${escapeAttribute(token.kind)}" title="${escapeAttribute(display.title)}" target="${escapeAttribute(token.target)}"${countAttribute}></roxy-agent-token>`
}

function renderMarkdownTableHtml(token: Tokens.Table, parser: unknown) {
  ;(defaultRenderer as any).parser = parser
  const tableHtml = defaultRenderer.table(token)
  const encodedMarkdown = encodeURIComponent(token.raw.trimEnd())

  return [
    '<div class="agent-md-table">',
    '<div class="agent-md-table__scroll">',
    tableHtml,
    '</div>',
    `<roxy-agent-table-copy encoded-markdown="${encodedMarkdown}"></roxy-agent-table-copy>`,
    '</div>',
  ].join('')
}

function renderMarkdownLinkHtml(token: Tokens.Link, parser: unknown) {
  if (!token.href.trim()) {
    return escapeHtml(token.raw)
  }

  ;(defaultRenderer as any).parser = parser

  const boundaryIndex = getBareUrlCjkBoundaryIndex(token)
  if (boundaryIndex === -1)
    return addMarkdownSourceAttribute(defaultRenderer.link(token), token.raw)

  const linkText = token.text.slice(0, boundaryIndex)
  const suffix = token.text.slice(boundaryIndex)
  const linkHref = token.href.slice(0, token.href.length - suffix.length)
  const linkToken: Tokens.Link = {
    ...token,
    raw: linkText,
    text: linkText,
    href: linkHref,
    tokens: [{ type: 'text', raw: linkText, text: linkText }],
  }

  return `${addMarkdownSourceAttribute(defaultRenderer.link(linkToken), linkToken.raw)}${escapeHtml(suffix)}`
}

function addMarkdownSourceAttribute(linkHtml: string, markdownSource: string) {
  return linkHtml.replace(
    '<a ',
    `<a data-markdown-source="${encodeURIComponent(markdownSource)}" `,
  )
}

function getBareUrlCjkBoundaryIndex(token: Tokens.Link) {
  if (token.raw !== token.text || !/^(?:(?:https?|ftp):\/\/|www\.)/i.test(token.text))
    return -1

  return token.text.search(/[\u3001\u3002\uFF0C\uFF01\uFF1F\uFF1B\uFF1A\uFF09\uFF3D\uFF5D\u3009\u300B\u300D\u300F\u3011\u3015\u3017\u3019\u301B\u201D\u2019]/u)
}

function normalizeMarkdownLinks(html: string) {
  if (typeof document === 'undefined')
    return html

  const template = document.createElement('template')
  template.innerHTML = html

  template.content.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    const filePath = resolveLocalFilePath(href)
    if (!filePath) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
      return
    }

    const fileName = getFileNameFromPath(filePath)
    link.setAttribute('href', toLocalFileUrl(filePath))
    link.setAttribute('download', fileName)
    link.setAttribute('data-local-file-path', filePath)
    link.removeAttribute('target')
    link.classList.add('agent-md-download')

    if (!link.textContent?.trim())
      link.textContent = fileName
  })

  return template.innerHTML
}

function resolveLocalFilePath(value: string | null) {
  const rawPath = value?.trim()
  if (!rawPath)
    return ''

  const filePath = normalizeWindowsDriveLocalPath(decodePathValue(rawPath))
  if (!filePath)
    return ''

  if (filePath.startsWith('file://'))
    return normalizeLocalFileUrlPath(filePath)

  if (/^[a-z]:[\\/]/i.test(filePath))
    return filePath

  if (/^[a-z][a-z\d+.-]*:/i.test(filePath))
    return ''

  if (filePath.startsWith('/') && !filePath.startsWith('//') && !filePath.startsWith('/api/') && getFileNameFromPath(filePath))
    return decodePathValue(filePath)

  return ''
}

function toLocalFileUrl(filePath: string) {
  if (filePath.startsWith('file://'))
    return encodeURI(filePath)

  const normalizedPath = filePath.replaceAll('\\', '/')
  if (/^[a-z]:\//i.test(normalizedPath))
    return `file:///${encodePathSegments(normalizedPath)}`

  return `file://${encodePathSegments(normalizedPath)}`
}

function normalizeLocalFileUrlPath(fileUrl: string) {
  const fileUrlPath = fileUrl.slice('file://'.length)
  if (/^\/[a-z]:[\\/]/i.test(fileUrlPath))
    return fileUrlPath.slice(1)

  if (/^[a-z]:[\\/]/i.test(fileUrlPath))
    return fileUrlPath

  return fileUrl
}

function normalizeWindowsDriveLocalPath(filePath: string) {
  return filePath.replace(/^\/(?=[a-z]:[\\/])/i, '')
}

function getAgentTokenDisplay(
  token: Pick<AgentMarkdownToken, 'kind' | 'title' | 'target'>,
): { title: string, count: string } {
  if (token.kind === 'input')
    return { title: token.target.trim() || token.title, count: '' }

  if (token.kind !== 'profile')
    return { title: token.title, count: '' }

  const titleCount = Number(token.title)
  const targetCount = token.target.split(',').filter(Boolean).length
  const count = Number.isFinite(titleCount) && titleCount > 0 ? titleCount : targetCount

  return {
    title: count > 0 ? $t('窗口') : $t('选择窗口'),
    count: count > 0 ? String(count) : '',
  }
}

function getFileNameFromPath(filePath: string) {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || 'download'
}

function encodePathSegments(filePath: string) {
  return filePath
    .split('/')
    .map(segment => encodeURIComponent(segment).replaceAll('%3A', ':'))
    .join('/')
}

function decodePathValue(filePath: string) {
  try {
    return decodeURI(filePath)
  }
  catch {
    return filePath
  }
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}
