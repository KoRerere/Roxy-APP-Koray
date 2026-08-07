import { z } from 'zod'

export const AgentChannelMessageIdSchema = z.string().min(1)

