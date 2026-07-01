import type { ScriptWithFile } from '../../database/conversations'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { z } from 'zod'
import { ScriptStore } from '../../database/conversations'
import { SCRIPT_PROMPT } from '../prompt/script'

/**
 * 解析脚本入参 JSON Schema 的属性名列表，用于表格摘要列。
 * - 非对象 schema / 无 properties / 解析失败 → null（表格显示 '-'）
 */
function extractOptionKeys(schemaRaw: string | null | undefined): string[] | null {
  if (!schemaRaw)
    return null
  let schema: any
  try {
    schema = typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw
  }
  catch {
    return null
  }
  if (!schema || typeof schema !== 'object' || schema.type !== 'object')
    return null
  const props = schema.properties
  if (!props || typeof props !== 'object')
    return null
  const keys = Object.keys(props)
  return keys.length > 0 ? keys : null
}

/** 规范化 schema 原文为可展示的 JSON 字符串（解析失败原样返回）。 */
function normalizeSchemaText(schemaRaw: string | null | undefined): string | null {
  if (!schemaRaw)
    return null
  if (typeof schemaRaw !== 'string')
    return null
  try {
    return JSON.stringify(JSON.parse(schemaRaw))
  }
  catch {
    return schemaRaw
  }
}

export const listScriptsTool: StructuredToolInterface = tool(
  async (_input: Record<string, never>): Promise<string> => {
    let scripts: ScriptWithFile[]
    try {
      scripts = ScriptStore.list()
    }
    catch {
      scripts = []
    }

    if (scripts.length === 0)
      return SCRIPT_PROMPT.listScripts.empty

    const cols = SCRIPT_PROMPT.listScripts.columnHeaders
    const header = `| ${cols.join(' | ')} |`
    const divider = `| ${cols.map(() => '---').join(' | ')} |`

    const rows = scripts.map((s) => {
      const runnable = s.oss_url || s.local_path ? '✅' : '❌'
      const desc = s.description ?? ''
      const dirId = s.dir_id ?? ''
      const createdAt = s.created_at ? s.created_at.slice(0, 16) : ''
      const optionKeys = extractOptionKeys(s.options_schema)
      const optionsCol = optionKeys ? optionKeys.join(',') : '-'
      return `| ${s.name} | ${s.id} | ${desc} | ${s.source ?? 'recording'} | ${runnable} | ${dirId} | ${createdAt} | ${optionsCol} |`
    })

    const tableHeader = SCRIPT_PROMPT.listScripts.headerTitle(scripts.length)
    const sections = [tableHeader, '', header, divider, ...rows]

    // 表格后附每个有 schema 的脚本的完整 JSON Schema，供 agent 构造 run_script 的 options 参数。
    const schemaSections: string[] = []
    for (const s of scripts) {
      const schemaText = normalizeSchemaText(s.options_schema)
      if (!schemaText)
        continue
      schemaSections.push(`### ${s.name} (\`${s.id}\`)`, '', '```json', schemaText, '```', '')
    }
    if (schemaSections.length > 0) {
      sections.push('', SCRIPT_PROMPT.listScripts.schemaTitle, '', ...schemaSections)
    }

    return sections.join('\n')
  },
  {
    name: 'list_scripts',
    description: SCRIPT_PROMPT.listScripts.description,
    schema: z.object({}),
  },
) as unknown as StructuredToolInterface
