import { z } from 'zod'

/** Permissive object schema for tests that are not about input validation. */
export const testToolInputSchema = z.looseObject({})
