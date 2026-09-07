import type { ToolDefinition, ToolHandlerResult } from 'roxy-agent-runtime'
import { defineTool } from 'roxy-agent-runtime'
import { z } from 'zod'
import { agentTemplatesApi, agentUserTemplatesApi } from '@/api/agentApiClient'
import { getSkillManager } from '@/core/skillManager'

export const LIST_TEMPLATES_TOOL_NAME = 'roxy_list_templates'
export const READ_TEMPLATE_INFO_TOOL_NAME = 'roxy_read_template_info'
export const DELETE_USER_TEMPLATE_TOOL_NAME = 'roxy_delete_user_template'

const templateIdSchema = z.number().int().positive()

const listTemplatesInputSchema = z.strictObject({
  scope: z.enum(['official', 'user']).describe('Official returns the complete catalog unless pagination is requested; user returns one workspace page.'),
  offset: z.number().int().min(0).optional().describe('Optional zero-based page offset. Defaults to 0 when pagination is requested.'),
  limit: z.number().int().min(1).max(200).optional().describe('Optional page size. Defaults to 20 when pagination is requested.'),
})

const readTemplateInfoInputSchema = z.strictObject({
  scope: z.enum(['official', 'user']).describe('The namespace that owns the template id.'),
  id: templateIdSchema,
})

const deleteUserTemplateInputSchema = z.strictObject({
  id: templateIdSchema.describe('The user template id in the current team workspace.'),
})

function jsonResult(value: unknown): ToolHandlerResult {
  return {
    content: JSON.stringify(value, null, 2),
    isError: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readUserSkillSlug(template: {
  templateType: string
  metadata: Record<string, unknown>
}): string {
  if (!['skill', 'skills'].includes(template.templateType.trim().toLowerCase())) {
    return ''
  }

  const metadata = template.metadata
  const nestedMetadata = isRecord(metadata.skillMetadata) ? metadata.skillMetadata : undefined
  const candidates = [
    metadata.packageSlug,
    metadata.package_slug,
    metadata.skillSlug,
    metadata.skill_slug,
    nestedMetadata?.packageSlug,
    nestedMetadata?.package_slug,
    nestedMetadata?.skillSlug,
    nestedMetadata?.skill_slug,
    nestedMetadata?.slug,
    metadata.slug,
  ]

  for (const candidate of candidates) {
    const slug = readNonEmptyString(candidate)
    if (slug) {
      return slug.startsWith('official-') ? slug.slice('official-'.length) : slug
    }
  }

  return ''
}

export function createListTemplatesTool(): ToolDefinition {
  return defineTool({
    name: LIST_TEMPLATES_TOOL_NAME,
    description: [
      'List official templates or user templates in the current team workspace.',
      'Without pagination arguments, the official catalog is returned in full for backward compatibility.',
      'When limit or offset is provided, official and user templates both support offset pagination.',
    ].join(' '),
    inputSchema: listTemplatesInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async (input) => {
      if (input.scope === 'official') {
        if (input.offset !== undefined || input.limit !== undefined) {
          const page = await agentTemplatesApi.listPage({
            offset: input.offset ?? 0,
            limit: input.limit ?? 20,
          })
          return jsonResult({ scope: input.scope, ...page })
        }

        const items = await agentTemplatesApi.listAll()
        return jsonResult({ scope: input.scope, items, total: items.length })
      }

      const page = await agentUserTemplatesApi.list({
        offset: input.offset ?? 0,
        limit: input.limit ?? 20,
      })
      return jsonResult({ scope: input.scope, ...page })
    },
  })
}

export function createReadTemplateInfoTool(): ToolDefinition {
  return defineTool({
    name: READ_TEMPLATE_INFO_TOOL_NAME,
    description: 'Read one official or user template by its namespace and numeric id.',
    inputSchema: readTemplateInfoInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async (input) => {
      const template = input.scope === 'official'
        ? await agentTemplatesApi.getById(input.id)
        : await agentUserTemplatesApi.getById(input.id)
      return jsonResult({ scope: input.scope, template })
    },
  })
}

export function createDeleteUserTemplateTool(): ToolDefinition {
  return defineTool({
    name: DELETE_USER_TEMPLATE_TOOL_NAME,
    description: 'Delete one user template from the current team workspace by numeric id.',
    inputSchema: deleteUserTemplateInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    handler: async (input) => {
      const template = await agentUserTemplatesApi.getById(input.id)
      const skillSlug = readUserSkillSlug(template)
      if (skillSlug) {
        await getSkillManager().deleteInstalledSkillBySlug(skillSlug)
      }
      await agentUserTemplatesApi.deleteById(input.id)
      return jsonResult({ deleted: true, scope: 'user', id: input.id })
    },
  })
}

export function createTemplateTools(): ToolDefinition[] {
  return [
    createListTemplatesTool(),
    createReadTemplateInfoTool(),
    createDeleteUserTemplateTool(),
  ]
}
