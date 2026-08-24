import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { NullClarificationHandler } from '../../src/clarification/handler.ts'
import { registerBuiltinTools } from '../../src/tools/builtin/index.ts'
import { zodToJsonSchema } from '../../src/tools/schema.ts'

describe('zodToJsonSchema', () => {
  it('serializes input descriptions, defaults, integer constraints, and strict objects', () => {
    // Regression: the hand-written converter rejected ZodDefault and callers
    // silently replaced the entire tool schema with an unconstrained object.
    // Fixed by: using Zod's complete input-mode JSON Schema conversion.
    const schema = z.strictObject({
      debug: z.boolean().default(false).describe('Enable debug output.'),
      timeoutMs: z.number().int().positive().optional().describe('Timeout in milliseconds.'),
    })

    expect(zodToJsonSchema(schema)).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        debug: {
          type: 'boolean',
          default: false,
          description: 'Enable debug output.',
        },
        timeoutMs: {
          type: 'integer',
          description: 'Timeout in milliseconds.',
        },
      },
    })
    expect(zodToJsonSchema(schema).required).toBeUndefined()
  })

  it('keeps function builtins object-shaped and custom builtins string-shaped', () => {
    // Regression: one builtin used a top-level union, so the complete tool list
    // passed local typing but was rejected by Responses function calling.
    // Fixed by: object-shaped function schemas plus a free-form string schema
    // for custom tools, which are not serialized as JSON Schema.
    const tools = registerBuiltinTools({
      enableTodos: true,
      clarificationHandler: new NullClarificationHandler(),
    })

    for (const tool of tools) {
      const schema = zodToJsonSchema(tool.descriptor.inputSchema)
      expect(schema.type, tool.descriptor.name).toBe(tool.descriptor.kind === 'custom' ? 'string' : 'object')
    }
  })
})
