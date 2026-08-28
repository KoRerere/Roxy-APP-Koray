export type MarkdownRenderContent
  = | { kind: 'text', content: string }
    | { kind: 'html', content: string }

export function resolveMarkdownRenderContent(
  content: string,
  streaming: boolean,
  render: (content: string) => string,
): MarkdownRenderContent {
  return streaming
    ? { kind: 'text', content }
    : { kind: 'html', content: render(content) }
}
