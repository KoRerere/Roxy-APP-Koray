export type ContentBlock
  = | { type: 'text', text: string }
    | { type: 'image', data: string, mimeType: string }
    | { type: 'file', data: string, mimeType: string }

/** 从 URL 下载图片，转为 base64 ContentBlock */
export async function imageUrlToBlock(
  url: string,
  mimeType = 'image/jpeg',
): Promise<ContentBlock> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}): ${url}`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  if (base64.length > 6_000_000) {
    throw new Error('图片过大（>5MB），请发送较小的图片。')
  }

  return { type: 'image', data: base64, mimeType }
}

/** 构建含图片和文字的消息内容 */
export async function buildMessageContent(
  text: string,
  imageUrls: string[] = [],
): Promise<string | ContentBlock[]> {
  if (imageUrls.length === 0)
    return text || '（无文字内容）'

  const blocks: ContentBlock[] = []
  for (const url of imageUrls) {
    blocks.push(await imageUrlToBlock(url))
  }
  if (text)
    blocks.push({ type: 'text', text })
  return blocks
}
