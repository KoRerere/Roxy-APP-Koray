import type { BaseChatModelParams } from '@langchain/core/language_models/chat_models'
import { ChatMoonshot } from './moonshot'

export type KimiFields = Partial<ConstructorParameters<typeof ChatMoonshot>[0]> & BaseChatModelParams

/** Kimi / Moonshot 兼容线路：继承本地 ChatMoonshot（自定义 apiUrl + bindTools + 工具消息）。 */
export class Kimi extends ChatMoonshot {
  constructor(fields: KimiFields = {}) {
    super(fields)
  }
}
