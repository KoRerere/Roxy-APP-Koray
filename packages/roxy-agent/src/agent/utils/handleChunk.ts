import type { ContentBlock, MessageContent } from '@langchain/core/messages'

export class HandleChunk {
  static handleContent(chunk: any) {
    const content = chunk.content as MessageContent
    if (typeof content === 'string') {
      return content
    }
    else if (Array.isArray(content)) {
      return content.map((item: ContentBlock) => item.text || '').join('')
    }
    else {
      return String(content || '')
    }
  }
}
