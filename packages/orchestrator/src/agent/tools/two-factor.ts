import { DynamicStructuredTool } from '@langchain/core/tools'
import { generate, verify } from 'otplib';
import { z } from 'zod'

export const twoFactorTools = [
  new DynamicStructuredTool({
    name: 'roxy_get_two_factor_code',
    description: 'get the two factor code for a given secret',
    schema: z.object({
      secret: z.string().describe('The secret to get the two factor code for'),
    }),
    func: async ({ secret }: { secret: string }) => {
      const code = await generate({ secret });
      return `The two factor code for ${secret} is: ${code}`;
    },
  }),
  new DynamicStructuredTool({
    name: 'roxy_verify_two_factor_code',
    description: 'verify the two factor code for a given secret',
    schema: z.object({
      secret: z.string().describe('The secret to verify the two factor code for'),
      code: z.string().describe('The code to verify'),
    }),
    func: async ({ secret, code }: { secret: string, code: string }) => {
      const result = await verify({ token: code, secret });
      return `${code} is ${result.valid ? 'valid' : 'invalid'}`;
    },
  }),
]
