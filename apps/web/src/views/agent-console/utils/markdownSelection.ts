export interface SelectedMarkdownLink {
  end: number
  markdown: string
  start: number
}

export function replaceSelectedLinksWithMarkdown(
  selectedText: string,
  links: SelectedMarkdownLink[],
) {
  const chunks: string[] = []
  let cursor = 0

  for (const link of [...links].sort((left, right) => left.start - right.start)) {
    const start = Math.max(0, link.start)
    const end = Math.min(selectedText.length, link.end)
    if (!link.markdown || start < cursor || end <= start)
      continue

    chunks.push(selectedText.slice(cursor, start), link.markdown)
    cursor = end
  }

  chunks.push(selectedText.slice(cursor))
  return chunks.join('')
}

export function getSelectionMarkdown(selection: Selection, root: ParentNode) {
  const range = selection.rangeCount ? selection.getRangeAt(0) : undefined
  const selectedText = selection.toString()
  if (!range || !selectedText)
    return selectedText

  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map(link => getSelectedMarkdownLink(range, link))
    .filter((link): link is SelectedMarkdownLink => Boolean(link))

  return replaceSelectedLinksWithMarkdown(selectedText, links)
}

function getSelectedMarkdownLink(range: Range, link: HTMLAnchorElement): SelectedMarkdownLink | undefined {
  if (!range.intersectsNode(link))
    return undefined

  const linkRange = link.ownerDocument.createRange()
  linkRange.selectNodeContents(link)

  const intersection = range.cloneRange()
  if (intersection.compareBoundaryPoints(Range.START_TO_START, linkRange) < 0)
    intersection.setStart(linkRange.startContainer, linkRange.startOffset)
  if (intersection.compareBoundaryPoints(Range.END_TO_END, linkRange) > 0)
    intersection.setEnd(linkRange.endContainer, linkRange.endOffset)

  const selectedLinkText = intersection.toString()
  if (!selectedLinkText)
    return undefined

  const prefixRange = range.cloneRange()
  prefixRange.setEnd(intersection.startContainer, intersection.startOffset)
  const start = prefixRange.toString().length

  return {
    start,
    end: start + selectedLinkText.length,
    markdown: getLinkMarkdown(link),
  }
}

function getLinkMarkdown(link: HTMLAnchorElement) {
  const encodedSource = link.dataset.markdownSource
  if (encodedSource) {
    try {
      return decodeURIComponent(encodedSource)
    }
    catch {
      // Fall through and rebuild the Markdown link from the rendered anchor.
    }
  }

  const label = link.textContent || link.getAttribute('href') || ''
  const href = link.getAttribute('href') || ''
  if (!href)
    return label

  return `[${escapeMarkdownLabel(label)}](${escapeMarkdownDestination(href)})`
}

function escapeMarkdownLabel(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

function escapeMarkdownDestination(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
}
