import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { z } from 'zod'
import { LibraryStore } from '@/script/libraryStore'

export const listScriptsTool: StructuredToolInterface = tool(
  async (_input: Record<string, never>): Promise<string> => {
    const scripts = LibraryStore.list()

    if (scripts.length === 0)
      return 'No runnable script'

    const cols = ['Name', 'Slug', 'Description', 'ScriptFile', 'Created']
    const header = `| ${cols.join(' | ')} |`
    const divider = `| ${cols.map(() => '---').join(' | ')} |`

    const rows = scripts.map((s) => {
      const desc = s.description ?? ''
      const createdAt = s.createdAt ? s.createdAt.slice(0, 16) : ''
      return `| ${s.name} | ${s.slug} | ${desc} | ${s.scriptFile} | ${createdAt} | `
    })

    const table = [header, divider, ...rows].map(line => line.trim()).join('\n')

    // 如果需要运行其中的某个脚本，可以先 get_script_self_description({ scriptPath: '...' }) 获取自描述。

    return table
  },
  {
    name: 'list_scripts',
    // 列出可用的脚本。
    description: 'List available scripts.',
    schema: z.object({}),
  },
) as unknown as StructuredToolInterface
