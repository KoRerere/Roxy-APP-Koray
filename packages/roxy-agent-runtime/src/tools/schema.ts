import { z } from 'zod'
import type { ZodType } from 'zod'
import type {
  JsonSchema,
  ToolContext,
  ToolDefinition,
  ToolDescriptor,
  ToolHandler,
  ToolHandlerResult,
} from '../core/interfaces.ts'

const definedToolHandlers = new WeakMap<ToolHandler, ToolHandler>()

/**
 * Convert a Zod input schema into provider-facing JSON Schema. Zod remains the
 * source of truth; unsupported constructs throw and callers must fix the Zod
 * schema instead of silently advertising an unconstrained fallback.
 */
export function zodToJsonSchema(schema: ZodType): JsonSchema {
  const { $schema: _schemaUri, ...jsonSchema } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'throw',
  })
  return jsonSchema
}

/** Convert a remote MCP JSON Schema into the mandatory Zod tool contract. */
export function jsonSchemaToZod(schema: JsonSchema): ZodType {
  return z.fromJSONSchema(schema)
}

export function formatToolInputError(toolName: string, error: unknown): string {
  const details =
    error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : String(error)
  return `invalid input for tool "${toolName}":\n${details}`
}

export async function parseToolInput(
  schema: ZodType,
  input: unknown,
  toolName: string,
): Promise<{ success: true; data: unknown } | { success: false; content: string }> {
  try {
    const parsed = await schema.safeParseAsync(input)
    return parsed.success
      ? { success: true, data: parsed.data }
      : { success: false, content: formatToolInputError(toolName, parsed.error) }
  } catch (error) {
    return { success: false, content: formatToolInputError(toolName, error) }
  }
}

export interface ToolDefinitionOptions<TSchema extends ZodType> extends Omit<
  ToolDescriptor,
  'inputSchema' | 'previewFn'
> {
  inputSchema: TSchema
  previewFn?: (input: z.infer<TSchema>) => Promise<string | undefined>
  handler: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<ToolHandlerResult>
}

/**
 * Define a local tool from a mandatory Zod schema. The returned handler keeps
 * direct/test invocation safe as well; ToolExecutor repeats validation at the
 * registry boundary so third-party registrations cannot bypass the contract.
 */
export function defineTool<TSchema extends ZodType>(options: ToolDefinitionOptions<TSchema>): ToolDefinition {
  const { handler, inputSchema, previewFn, ...descriptor } = options
  const parsedHandler: ToolHandler = (input, ctx) => handler(input as z.infer<TSchema>, ctx)
  const validatingHandler: ToolHandler = async (input, ctx) => {
    const parsed = await parseToolInput(inputSchema, input, descriptor.name)
    if (!parsed.success) {
      return {
        content: parsed.content,
        isError: true,
        errorKind: 'input_invalid',
      }
    }
    return parsedHandler(parsed.data, ctx)
  }
  definedToolHandlers.set(validatingHandler, parsedHandler)

  return {
    descriptor: {
      ...descriptor,
      inputSchema,
      ...(previewFn
        ? {
            previewFn: async (input: unknown) => {
              const parsed = await inputSchema.safeParseAsync(input)
              return parsed.success ? previewFn(parsed.data) : undefined
            },
          }
        : {}),
    },
    handler: validatingHandler,
  }
}

/** Avoid applying Zod transforms twice when ToolExecutor calls a defineTool wrapper. */
export function unwrapDefinedToolHandler(handler: ToolHandler): ToolHandler {
  return definedToolHandlers.get(handler) ?? handler
}
