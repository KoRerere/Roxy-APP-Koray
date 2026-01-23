import type { BaseMessage } from '@langchain/core/messages'

/**
 * 将 message 转成文本格式。
 * @param messages 
 * @returns 
 */
export const messagesToText = (messages: BaseMessage[]) => {
  return messages.map((msg: any) => {
    const role = msg._getType() === 'human' ? 'User' : 'Assistant'
    let content = ''
    if (typeof msg.content === 'string') {
      content = msg.content
    }
    else if (Array.isArray(msg.content)) {
      // If content is array of content blocks, extract text
      content = msg.content
        .map((block: any) => typeof block === 'string' ? block : block.text || '')
        .join('')
    }
    else {
      content = String(msg.content || '')
    }
    return `${role}: ${content}`
  }).join('\n')
}