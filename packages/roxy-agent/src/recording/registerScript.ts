import type { FileRecord } from '@/database/conversations'
import { AI_AGENT_API } from '@/api'
import { ChatContextAPI, ScriptStore } from '@/database/conversations'

async function getConversationTitle(conversationId: string): Promise<string | null> {
  try {
    return ChatContextAPI.getConversation(conversationId)?.title ?? null
  }
  catch {
    return null
  }
}

export interface RegisterScriptOptions {
  sessionId: string
  conversationId: string
  dirId?: string
  description?: string
  optionsSchema?: string
}

export async function registerScriptRecord(record: FileRecord, opts: RegisterScriptOptions): Promise<boolean> {
  const { sessionId, conversationId, dirId, description, optionsSchema } = opts
  const name = (await getConversationTitle(conversationId)) || `recording_${sessionId}`

  let finalName = name
  let localScriptId: string | null = null
  try {
    const created = ScriptStore.create({
      name,
      file_id: record.file_id,
      conversation_id: conversationId,
      recording_id: sessionId,
      dir_id: dirId,
      description,
      options_schema: optionsSchema,
      source: 'recording',
    })
    finalName = created.name
    localScriptId = created.id
  }
  catch (err: any) {
    console.warn('[Recording] register script (local) failed:', err?.message)
  }

  if (!record.remote_file_id || !record.oss_url) {
    console.warn(
      '[Recording] skip backend script sync: missing remote_file_id or oss_url (OSS upload likely failed)',
    )
    return false
  }
  try {
    const dto = await AI_AGENT_API.scripts.create({
      name: finalName,
      file_id: record.remote_file_id,
      oss_url: record.oss_url,
      description,
      source: 'recording',
      conversation_id: conversationId,
      recording_id: sessionId,
      dir_id: dirId,
      options_schema: optionsSchema,
    })

    if (localScriptId && dto?.id != null) {
      try {
        ScriptStore.setRemoteId(localScriptId, dto.id)
      }
      catch (e: any) {
        console.warn('[Recording] set remote_id failed:', e?.message)
      }
    }
    return true
  }
  catch (err: any) {
    console.warn('[Recording] sync script to backend failed:', err?.message)
    return false
  }
}
