import { z } from 'zod'
import type { IClarificationHandler } from '../../core/interfaces.ts'
import type { BuiltinTool } from './index.ts'
import { defineTool } from '../schema.ts'

const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Value must not be empty.')

const askUserOptionSchema = z.strictObject({
  label: nonEmptyString
    .refine((value) => value.trim().split(/\s+/).length <= 5, 'Option label must contain 1 to 5 words.')
    .refine((value) => !/^(other|其他)$/i.test(value.trim()), 'Do not add an Other option; the client supplies it.'),
  description: nonEmptyString.describe('One sentence describing this option’s impact or tradeoff.'),
})

const askUserQuestionSchema = z.strictObject({
  header: nonEmptyString.max(12).describe('Short UI title, at most 12 characters.'),
  id: nonEmptyString.describe('Stable identifier; use snake_case when practical.'),
  question: nonEmptyString.describe('One-sentence question for the user.'),
  options: z
    .array(askUserOptionSchema)
    .min(2)
    .max(3)
    .describe('Two or three mutually exclusive choices; put the recommendation first.'),
})

export const askUserInputSchema = z.strictObject({
  questions: z
    .array(askUserQuestionSchema)
    .min(1)
    .max(3)
    .describe('One to three questions. This is the only top-level input field.'),
})

/** Model-initiated user clarification tool. */
export function ask_userTool(clarificationHandler: IClarificationHandler): BuiltinTool {
  return defineTool({
    name: 'ask_user',
    description: [
      'Ask the user one to three clarifying questions and wait for their reply.',
      'Input must be exactly { questions: [...] }. Each question needs header, stable id, one-sentence question, and 2-3 mutually exclusive options.',
      'Put the recommended option first. Do not add an Other option; the client adds free-form input automatically.',
      'The tool result is a JSON object mapping each question id to the user’s selected or typed answer.',
    ].join(' '),
    inputSchema: askUserInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, _ctx) => {
      const req = {
        traceId: _ctx.traceId,
        questions: input.questions,
      }
      const result = await clarificationHandler.request(req)
      return { content: result.answer, isError: false }
    },
  })
}
