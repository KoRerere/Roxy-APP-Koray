import type { StructuredToolInterface } from '@langchain/core/tools'
import { ToolMessage } from '@langchain/core/messages'
import { Command, END } from '@langchain/langgraph'
import { tool } from 'langchain'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { RECORDING_PROMPT } from '@/deepagents/prompt/recording'
import { formatValidationReport, validateScript } from '@/recording/validator'
import { createRunScriptTool } from './run_script'

export interface EnhanceToolContext {
  workspaceDir: string
  defaultDirId?: string
  onSaved: (finalScript: string, optionsSchema: string) => void
}

function resolveWorkspaceFilePath(workspaceDir: string, virtualPath: string): string {
  const trimmedPath = virtualPath.trim()
  if (/^[a-z]:/i.test(trimmedPath) || trimmedPath.startsWith('\\\\') || trimmedPath.startsWith('//') || trimmedPath.startsWith('\\'))
    throw new Error(RECORDING_PROMPT.tools.pathOutOfWorkspace(virtualPath))

  const rawPath = trimmedPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (rawPath.split('/').includes('..'))
    throw new Error(RECORDING_PROMPT.tools.pathTraversal(virtualPath))
  const normalized = path.posix.normalize(`/${rawPath}`).replace(/^\/+/, '')
  if (!normalized || normalized === '.')
    throw new Error(RECORDING_PROMPT.tools.pathOutOfWorkspace(virtualPath))
  if (normalized.startsWith('~'))
    throw new Error(RECORDING_PROMPT.tools.pathOutOfWorkspace(virtualPath))
  return path.join(workspaceDir, normalized)
}

function createValidateScriptTool(ctx: EnhanceToolContext): StructuredToolInterface {
  return tool(
    async (input: { path: string }): Promise<string> => {
      let scriptPath: string
      try {
        scriptPath = resolveWorkspaceFilePath(ctx.workspaceDir, input.path)
      }
      catch (err: any) {
        return String(err?.message ?? err)
      }

      let script: string
      try {
        script = await fsPromises.readFile(scriptPath, 'utf-8')
      }
      catch (err: any) {
        return RECORDING_PROMPT.tools.validateReadError(input.path, String(err?.message ?? err))
      }

      if (!script.trim())
        return RECORDING_PROMPT.tools.validateEmpty(input.path)

      return formatValidationReport(validateScript(script))
    },
    {
      name: 'validate_script',
      description: RECORDING_PROMPT.tools.validateDescription,
      schema: z.object({
        path: z.string().describe(RECORDING_PROMPT.tools.validatePathDescription),
      }),
    },
  ) as unknown as StructuredToolInterface
}

function createSaveScriptTool(ctx: EnhanceToolContext): StructuredToolInterface {
  return tool(
    async (input: { path: string, optionsSchema?: unknown }, config: any): Promise<string | Command> => {
      if (!input.path) {
        return RECORDING_PROMPT.tools.paramIsEmpty('path')
      }

      // 归一 optionsSchema：string 原样、object → JSON.stringify、undefined/空 → 视为空 schema '{}'。
      // 不静默回退读 script_schema.json：optionsSchema 参数是入库的权威来源，缺失即要求 agent 重传。
      let normalizedSchema = '{}'
      if (input.optionsSchema !== undefined && input.optionsSchema !== null) {
        if (typeof input.optionsSchema === 'string') {
          const trimmed = input.optionsSchema.trim()
          if (trimmed) {
            try {
              // 校验是合法 JSON 后再以规范化的字符串形式保存
              normalizedSchema = JSON.stringify(JSON.parse(trimmed))
            }
            catch (err: any) {
              return RECORDING_PROMPT.tools.optionsSchemaParseFailed(String(err?.message ?? err))
            }
          }
        }
        else {
          try {
            normalizedSchema = JSON.stringify(input.optionsSchema)
          }
          catch (err: any) {
            return RECORDING_PROMPT.tools.optionsSchemaParseFailed(String(err?.message ?? err))
          }
        }
      }

      let scriptPath: string
      try {
        scriptPath = resolveWorkspaceFilePath(ctx.workspaceDir, input.path)
      }
      catch (err: any) {
        return `${String(err?.message ?? err)} ${RECORDING_PROMPT.tools.pathRetry}`
      }

      let script: string
      try {
        script = await fsPromises.readFile(scriptPath, 'utf-8')
      }
      catch (err: any) {
        return RECORDING_PROMPT.tools.saveReadError(input.path, String(err?.message ?? err))
      }

      if (!script.trim())
        return RECORDING_PROMPT.tools.saveEmpty(input.path)

      ctx.onSaved(script, normalizedSchema)

      const content = RECORDING_PROMPT.tools.saveResult(script.length)

      const toolCallId: string | undefined = config?.toolCall?.id ?? config?.configurable?.tool_call_id
      if (!toolCallId)
        return content

      return new Command({
        goto: END,
        update: {
          messages: [new ToolMessage({ content, name: 'save_script', tool_call_id: toolCallId })],
        },
      })
    },
    {
      name: 'save_script',
      description: RECORDING_PROMPT.tools.saveDescription,
      schema: z.object({
        path: z.string().optional().describe(RECORDING_PROMPT.tools.savePathDescription),
        optionsSchema: z.unknown().optional().describe(RECORDING_PROMPT.tools.optionsSchemaDescription),
      }),
    },
  ) as unknown as StructuredToolInterface
}

export function createEnhanceTools(ctx: EnhanceToolContext): StructuredToolInterface[] {
  return [
    createValidateScriptTool(ctx),
    createRunScriptTool({
      workspaceDir: ctx.workspaceDir,
      defaultDirId: ctx.defaultDirId,
      defaultProfile: 'debug',
      allowLocalPaths: true,
      scriptOutputDir: path.join(ctx.workspaceDir, 'script-run'),
      scriptLogsDir: ctx.workspaceDir,
    }),
    createSaveScriptTool(ctx),
  ]
}
