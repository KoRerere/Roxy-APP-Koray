import type { ContextContribution, Message } from '../core/interfaces.ts'

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function renderSummaryContext(summary: string | null): Message[] {
  if (!summary?.trim()) {
    return []
  }

  return [
    {
      role: 'developer',
      content: `<compaction_summary>\n${escapeXml(summary)}\n</compaction_summary>`,
      visible: false,
    },
  ]
}

export function renderContributionContext(contributions: ContextContribution[]): Message[] {
  return contributions.map(({ name, content }) => ({
    role: 'developer',
    content: `<context_contribution>\n<name>${escapeXml(name)}</name>\n<content>${escapeXml(content)}</content>\n</context_contribution>`,
    visible: false,
  }))
}
