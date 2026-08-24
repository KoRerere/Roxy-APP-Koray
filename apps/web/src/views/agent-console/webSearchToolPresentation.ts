import { getUrlFaviconUrl } from './utils/urlFavicon'

export interface WebSearchQueriesPresentation {
  action: 'search'
  queries: string[]
}

export interface WebSearchOpenPagePresentation {
  action: 'open_page'
  url: string
  faviconUrl?: string
}

export interface WebSearchFindInPagePresentation {
  action: 'find_in_page'
  url: string
  pattern: string
  faviconUrl?: string
}

export type WebSearchToolPresentation = WebSearchQueriesPresentation | WebSearchOpenPagePresentation | WebSearchFindInPagePresentation

interface WebSearchUrlPresentation {
  url: string
  faviconUrl?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function actionRecord(input: unknown): Record<string, unknown> {
  const record = asRecord(input)
  return typeof record.type === 'string' ? record : asRecord(record.action)
}

function searchQueries(record: Record<string, unknown>): string[] {
  const values = Array.isArray(record.queries)
    ? record.queries
    : typeof record.query === 'string'
      ? [record.query]
      : []

  return values.flatMap((value) => {
    if (typeof value !== 'string') {
      return []
    }
    const query = value.trim()
    return query && !/^ws_call_id=/i.test(query) ? [query] : []
  })
}

function pagePresentation(value: unknown): WebSearchUrlPresentation | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  const rawUrl = value.trim()
  try {
    const url = new URL(rawUrl)
    url.searchParams.delete('ws_call_id')
    if (/^#ws_call_id=/i.test(url.hash)) {
      url.hash = ''
    }

    const presentation: WebSearchUrlPresentation = {
      url: url.toString(),
    }
    const faviconUrl = getUrlFaviconUrl(url.toString())
    if (faviconUrl) {
      presentation.faviconUrl = faviconUrl
    }
    return presentation
  }
  catch {
    return { url: rawUrl }
  }
}

export function getWebSearchToolPresentation(input: unknown): WebSearchToolPresentation | undefined {
  const record = actionRecord(input)
  if (record.type === 'search') {
    return { action: 'search', queries: searchQueries(record) }
  }
  if (record.type === 'open_page') {
    const presentation = pagePresentation(record.url)
    return presentation ? { action: 'open_page', ...presentation } : undefined
  }
  if (record.type === 'find_in_page') {
    const pattern = typeof record.pattern === 'string' ? record.pattern.trim() : ''
    const presentation = pagePresentation(record.url)
    return presentation && pattern ? { action: 'find_in_page', ...presentation, pattern } : undefined
  }
  return undefined
}
